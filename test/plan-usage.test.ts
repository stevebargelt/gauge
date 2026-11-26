import assert from "node:assert/strict";
import { test } from "node:test";
import { collectPlanUsage } from "../src/plan-usage.js";

const NOW = Date.parse("2026-07-27T18:00:00.000Z");

test("normalizes Claude subscription windows without exposing the credential", async () => {
  const secret = "sk-ant-oat01-this-is-only-a-test";
  const result = await collectPlanUsage({
    env: {},
    homeDir: "/does-not-exist",
    now: () => NOW,
    claudeVersion: "2.1.148",
    readClaudeCredential: () => ({
      accessToken: secret,
      subscriptionType: "max20",
    }),
    fetchImpl: async (_url, init) => {
      assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${secret}`);
      return new Response(JSON.stringify({
        limits: [
          { kind: "session", percent: 42, resets_at: "2026-07-27T20:00:00.000Z" },
          { kind: "weekly_all", percent: 28, resets_at: "2026-08-01T18:00:00.000Z" },
        ],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
    codexAppServerQuery: async () => null,
  });

  assert.equal(result.services.length, 1);
  const claude = result.services[0]!;
  assert.equal(claude.id, "claude-subscription");
  assert.equal(claude.plan, "Claude Max (20x)");
  assert.deepEqual(claude.windows.map((window) => window.usedPct), [42, 28]);
  assert.equal(JSON.stringify(result).includes(secret), false);
});

test("normalizes Codex App Server limits and labels API-key channels honestly", async () => {
  const result = await collectPlanUsage({
    env: {
      ANTHROPIC_API_KEY: "present",
      OPENAI_API_KEY: "present",
      CLAUDE_CODE_USE_BEDROCK: "1",
      AWS_PROFILE: "work",
    },
    homeDir: "/does-not-exist",
    now: () => NOW,
    readClaudeCredential: () => null,
    codexAppServerQuery: async () => ({
      planType: "prolite",
      primary: {
        used_percent: 17,
        window_minutes: 300,
        resets_at: (NOW + 2 * 60 * 60_000) / 1000,
      },
      secondary: {
        used_percent: 31,
        window_minutes: 10080,
        resets_at: (NOW + 4 * 24 * 60 * 60_000) / 1000,
      },
      observedAt: new Date(NOW).toISOString(),
      source: "codex-app-server",
    }),
  });

  assert.deepEqual(result.services.map((service) => service.id), [
    "anthropic-api",
    "bedrock",
    "codex-subscription",
    "openai-api",
  ]);
  const codex = result.services.find((service) => service.id === "codex-subscription")!;
  assert.equal(codex.plan, "ChatGPT Pro (5×)");
  assert.deepEqual(codex.windows.map((window) => window.label), ["5h", "Weekly"]);
  assert.equal(result.services.find((service) => service.id === "openai-api")?.status, "not_applicable");
  assert.equal(result.services.find((service) => service.id === "bedrock")?.status, "not_configured");
});
