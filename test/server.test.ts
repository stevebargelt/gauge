import assert from "node:assert/strict";
import { test } from "node:test";
import type { AddressInfo } from "node:net";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAppServer } from "../src/server.js";
import { resetPlanUsageCacheForTests, type CollectorOptions } from "../src/plan-usage.js";

test("standalone server returns sample limits and the browser application", async (context) => {
  const server = createAppServer({ sample: true });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const address = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${address.port}`;

  const api = await fetch(`${base}/api/usage/limits`);
  assert.equal(api.status, 200);
  assert.equal(api.headers.get("cache-control"), "no-store");
  const body = await api.json() as { services: Array<{ id: string }> };
  assert.deepEqual(body.services.slice(0, 2).map((service) => service.id), [
    "claude-subscription",
    "codex-subscription",
  ]);

  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(
    page.headers.get("content-security-policy") ?? "",
    /style-src 'self' 'unsafe-inline'/,
    "the CSP must permit the panel's generated provider colors and numeric bar widths",
  );
  assert.match(await page.text(), /AI subscription headroom/);

  const app = await fetch(`${base}/app.js`);
  assert.equal(app.status, 200);
  assert.match(await app.text(), /Plan limits &amp; windows/);
});

const ROUTE_NOW = Date.parse("2026-07-15T19:00:00.000Z");

async function listen(server: ReturnType<typeof createAppServer>, context: { after: (fn: () => Promise<void>) => void }) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function fixtureCollector(now: () => number): CollectorOptions {
  return {
    env: { CLAUDE_CODE_USE_BEDROCK: "1", AWS_PROFILE: "integration-test" },
    homeDir: mkdtempSync(join(tmpdir(), "gauge-route-")),
    now,
    readClaudeCredential: () => null,
    codexAppServerQuery: async () => ({
      planType: "prolite",
      primary: { used_percent: 14, window_minutes: 300, resets_at: (ROUTE_NOW + 3_600_000) / 1000 },
      secondary: null,
      observedAt: new Date(ROUTE_NOW).toISOString(),
      source: "codex-app-server",
    }),
  };
}

test("GET /api/usage/limits returns the normalized provider contract", async (context) => {
  resetPlanUsageCacheForTests();
  const base = await listen(createAppServer({ collector: fixtureCollector(() => ROUTE_NOW) }), context);

  const response = await fetch(`${base}/api/usage/limits`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json() as {
    generatedAt: string;
    services: Array<{ id: string; status: string; plan: string | null }>;
  };
  assert.equal(body.generatedAt, "2026-07-15T19:00:00.000Z");
  assert.deepEqual(body.services.map((service) => service.id), ["bedrock", "codex-subscription"]);
  assert.equal(body.services[0]!.status, "not_configured");
  assert.equal(body.services[0]!.plan, "AWS usage · integration-test");
  assert.equal(body.services[1]!.status, "live");
  assert.equal(body.services[1]!.plan, "ChatGPT Pro (5×)");
});

test("GET /api/usage/limits serves the short cache, and ?refresh=1 bypasses it", async (context) => {
  resetPlanUsageCacheForTests();
  let clock = ROUTE_NOW;
  const base = await listen(createAppServer({ collector: fixtureCollector(() => (clock += 1_000)) }), context);
  const read = async (query = "") =>
    (await fetch(`${base}/api/usage/limits${query}`).then((response) => response.json()) as { generatedAt: string }).generatedAt;

  const first = await read();
  assert.equal(await read(), first, "a second read inside the cache window is the cached reading");
  const refreshed = await read("?refresh=1");
  assert.ok(Date.parse(refreshed) > Date.parse(first));
});
