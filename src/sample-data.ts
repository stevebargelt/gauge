import type { PlanUsageResponse } from "./plan-usage.js";

export function samplePlanUsage(now = Date.now()): PlanUsageResponse {
  const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString();
  return {
    generatedAt: new Date(now).toISOString(),
    services: [
      {
        id: "claude-subscription",
        name: "Claude Code",
        plan: "Claude Max (20x)",
        authMode: "oauth",
        status: "live",
        source: "anthropic-oauth-api",
        observedAt: new Date(now).toISOString(),
        windows: [
          { label: "5-hour limit", usedPct: 42, resetsAt: iso(2 * 60 * 60_000), elapsedPct: 60, pacePct: 70 },
          { label: "Weekly · all models", usedPct: 28, resetsAt: iso(4 * 24 * 60 * 60_000), elapsedPct: 43, pacePct: 65 },
        ],
        note: null,
      },
      {
        id: "codex-subscription",
        name: "Codex",
        plan: "ChatGPT Pro (20×)",
        authMode: "subscription",
        status: "live",
        source: "codex-app-server",
        observedAt: new Date(now).toISOString(),
        windows: [
          { label: "5h", usedPct: 61, resetsAt: iso(3 * 60 * 60_000), elapsedPct: 50, pacePct: 122 },
          { label: "Weekly", usedPct: 33, resetsAt: iso(5 * 24 * 60 * 60_000), elapsedPct: 29, pacePct: 114 },
        ],
        note: null,
      },
      {
        id: "anthropic-api",
        name: "Anthropic API",
        plan: "Usage-based billing",
        authMode: "api_key",
        status: "not_applicable",
        source: "environment",
        observedAt: null,
        windows: [],
        note: "Subscription limit windows do not apply to Anthropic API-key billing.",
      },
      {
        id: "bedrock",
        name: "Amazon Bedrock",
        plan: "AWS usage · example-profile",
        authMode: "bedrock",
        status: "not_configured",
        source: "environment",
        observedAt: null,
        windows: [],
        note: "Bedrock usage metrics are not configured on this host yet.",
      },
      {
        id: "openai-api",
        name: "OpenAI API",
        plan: "Usage-based billing",
        authMode: "api_key",
        status: "not_applicable",
        source: "environment",
        observedAt: null,
        windows: [],
        note: "Subscription limit windows do not apply to OpenAI API-key billing.",
      },
    ],
  };
}
