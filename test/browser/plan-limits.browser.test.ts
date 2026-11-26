// The page, in a real browser, served by the real server with stubbed collector
// sources. Needs Chrome; run with `npm run test:browser`.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { chromium, type Browser, type Page } from "playwright-core";
import { resetPlanUsageCacheForTests, type CollectorOptions } from "../../src/plan-usage.js";
import { createAppServer } from "../../src/server.js";

const CHROME_LOCATIONS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

// What the stubbed sources report. Each test sets the parts it needs.
const fixture = {
  mode: "full" as "full" | "empty" | "claude-error",
  delayMs: 0,
  collectorThrows: false,
  claudeUsedPct: 42,
};

function stubbedCollector(): CollectorOptions {
  const homeDir = mkdtempSync(join(tmpdir(), "gauge-browser-"));
  return {
    get env() {
      return fixture.mode === "empty"
        ? {}
        : { ANTHROPIC_API_KEY: "test-only", OPENAI_API_KEY: "test-only", CLAUDE_CODE_USE_BEDROCK: "1", AWS_PROFILE: "work" };
    },
    homeDir,
    claudeVersion: "test",
    readClaudeCredential: () => {
      if (fixture.collectorThrows) throw new Error("collector failure");
      return fixture.mode === "empty" ? null : { accessToken: "sk-ant-oat01-test-only", subscriptionType: "max20" };
    },
    fetchImpl: async () => {
      await new Promise((resolve) => setTimeout(resolve, fixture.delayMs));
      if (fixture.mode === "claude-error") throw new TypeError("fetch failed");
      return Response.json({
        limits: [{ kind: "session", percent: fixture.claudeUsedPct, resets_at: new Date(Date.now() + 2 * 3_600_000).toISOString() }],
      });
    },
    codexAppServerQuery: async () => {
      await new Promise((resolve) => setTimeout(resolve, fixture.delayMs));
      if (fixture.mode === "empty") return null;
      return {
        planType: "prolite",
        primary: { used_percent: 61, window_minutes: 300, resets_at: (Date.now() + 3_600_000) / 1000 },
        secondary: null,
        observedAt: new Date().toISOString(),
        source: "codex-app-server",
      };
    },
  };
}

let server: ReturnType<typeof createAppServer>;
let browser: Browser;
let baseUrl = "";

before(async () => {
  const executablePath = process.env.CHROME_PATH ?? CHROME_LOCATIONS.find((path) => existsSync(path));
  assert.ok(executablePath, "Chrome was not found; set CHROME_PATH to run the browser tests");
  server = createAppServer({ collector: stubbedCollector() });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  browser = await chromium.launch({ executablePath, headless: true });
});

after(async () => {
  await browser?.close();
  server?.closeAllConnections();
  await new Promise<void>((resolve) => server?.close(() => resolve()));
});

beforeEach(() => {
  resetPlanUsageCacheForTests();
  Object.assign(fixture, { mode: "full", delayMs: 0, collectorThrows: false, claudeUsedPct: 42 });
});

test("the page renders every service, keeps the last readings when a refresh fails, and shows a successful refresh", async () => {
  const page = await newPage({ width: 1440, height: 1000 });
  await page.goto(baseUrl);
  await page.locator(".plan-service").first().waitFor();

  assert.equal(await page.title(), "gauge");
  assert.deepEqual(await page.locator(".plan-service-name-row strong").allTextContents(), [
    "Claude Code", "Anthropic API", "Amazon Bedrock", "Codex", "OpenAI API",
  ]);
  assert.deepEqual(await page.locator(".plan-status").allTextContents(), [
    "live", "not applicable", "not configured", "live", "not applicable",
  ]);
  assert.equal(await page.locator(".plan-dial-progress").count(), 2, "API-key and Bedrock channels must not draw progress rings");
  assert.equal(await page.locator(".plan-window-label strong").first().innerText(), "42%");

  fixture.collectorThrows = true;
  await page.getByRole("button", { name: "refresh" }).click();
  await page.locator(".plan-refresh-error").waitFor();
  assert.match(await page.locator(".plan-refresh-error").innerText(), /sync failed \(HTTP 500\)/);
  assert.equal(await page.locator(".plan-service").count(), 5, "a failed refresh must keep the last successful readings");

  fixture.collectorThrows = false;
  fixture.claudeUsedPct = 55;
  await page.getByRole("button", { name: "refresh" }).click();
  await page.locator(".plan-window-label strong", { hasText: "55%" }).waitFor();
  assert.equal(await page.locator(".plan-refresh-error").count(), 0);
  await page.close();
});

test("the page distinguishes loading, empty, and a failed source", async () => {
  fixture.mode = "empty";
  fixture.delayMs = 350;
  const loading = await newPage({ width: 1200, height: 800 });
  await loading.goto(baseUrl);
  await loading.getByText("Loading host plan limits…").waitFor();
  await loading.getByText("No host plan-limit services were reported.").waitFor();
  await loading.close();

  resetPlanUsageCacheForTests();
  fixture.mode = "claude-error";
  fixture.delayMs = 0;
  const failed = await newPage({ width: 1200, height: 800 });
  await failed.goto(baseUrl);
  const claude = failed.locator(".plan-service").first();
  await claude.locator(".plan-status-error").waitFor();
  assert.equal(await claude.locator(".plan-dial-value").innerText(), "—", "a failed source shows no number, never 0%");
  assert.match(await claude.locator(".plan-service-note").innerText(), /currently unreachable/);
  await failed.close();
});

test("the page stays contained at a phone-sized width", async () => {
  const page = await newPage({ width: 390, height: 844 });
  await page.goto(baseUrl);
  await page.locator(".plan-service").first().waitFor();
  const layout = await page.evaluate(() => {
    const services = Array.from(document.querySelectorAll(".plan-service"), (element) => element.getBoundingClientRect());
    return {
      innerWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      maxServiceRight: Math.max(...services.map((rect) => rect.right)),
      minServiceLeft: Math.min(...services.map((rect) => rect.left)),
    };
  });
  assert.ok(layout.documentWidth <= layout.innerWidth, JSON.stringify(layout));
  assert.ok(layout.maxServiceRight <= layout.innerWidth, JSON.stringify(layout));
  assert.ok(layout.minServiceLeft >= 0, JSON.stringify(layout));
  await page.close();
});

async function newPage(viewport: { width: number; height: number }): Promise<Page> {
  const page = await browser.newPage({ viewport });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("close", () => assert.deepEqual(errors, [], `browser errors: ${errors.join("; ")}`));
  return page;
}
