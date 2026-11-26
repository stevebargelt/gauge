import assert from "node:assert/strict";
import { test } from "node:test";
import type { AddressInfo } from "node:net";
import { createAppServer } from "../src/server.js";

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
