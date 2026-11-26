# Live Usage Plan Limits

A small, standalone local dashboard showing Claude Code and Codex subscription
usage windows. It is an extracted, portable version of Forge's **Live usage —
Plan limits & windows** panel.

It does not require Forge, a database, React, or a build step. The server uses
Node.js; the browser UI is plain JavaScript and CSS.

## Fastest way to see it

Requirements: Node.js 20 or newer.

```sh
npm install
npm run sample
```

Open <http://127.0.0.1:4312>. Sample mode uses realistic fake data and does not
read any credentials.

To show the subscriptions already signed in on the computer:

```sh
npm start
```

Keep the terminal open while using the page. Press `Ctrl+C` to stop it.

## What works

- Claude Code subscription windows: session/5-hour, weekly-all, and any
  model-scoped weekly limits returned by Anthropic.
- Codex/ChatGPT subscription windows: current rate limits from the local Codex
  App Server.
- A bounded scan of recent Codex rollout files when the live App Server query is
  unavailable. This is clearly labeled stale.
- Separate, honest rows for Anthropic API keys, OpenAI API keys, and Amazon
  Bedrock. Those channels are usage-billed and do not have the subscription
  windows shown for Claude Code or ChatGPT, so the dashboard does not invent
  quota numbers.
- Manual refresh, a 30-second server cache, reset countdowns, and pace
  calculations.
- Responsive desktop and phone layouts.

Either CLI can be absent. The dashboard simply omits a subscription it cannot
observe.

## How it obtains the data

### Claude Code

The collector looks for Claude Code's OAuth credential in:

1. `CLAUDE_CONFIG_DIR/.credentials.json`, when `CLAUDE_CONFIG_DIR` is set;
2. otherwise `~/.claude/.credentials.json`;
3. on macOS, the `Claude Code-credentials` Keychain item.

It sends the OAuth access token from the server directly to Anthropic's observed
usage integration and normalizes the response. This Anthropic endpoint is used
by Claude Code but should not be treated as a stable public API contract.

### Codex

The collector starts:

```sh
codex app-server --stdio
```

It initializes the local App Server and calls `account/rateLimits/read`. If that
does not return a usable result, it scans a bounded set of recent rollout files
under `~/.codex/sessions` for the latest observed rate-limit record.

The App Server owns authentication. This project does not send a Codex token to
the browser or to a third-party service.

## Security boundary

- The server binds to `127.0.0.1` by default.
- The browser receives only normalized plan names, percentages, window
  durations, reset times, observation status, and explanatory notes.
- Raw credentials and raw provider/App Server responses are never returned by
  `/api/usage/limits`.
- The browser application escapes provider-derived text before rendering it.
- The API response uses `Cache-Control: no-store`.
- The page uses a same-origin Content Security Policy.

Do not expose this server to the public internet without adding authentication.
Even though it does not expose tokens, account plan and usage information is
private.

## Useful configuration

| Environment variable | Purpose |
| --- | --- |
| `PLAN_LIMITS_HOST` | Bind address; defaults to `127.0.0.1` |
| `PLAN_LIMITS_PORT` | HTTP port; defaults to `4312` |
| `PLAN_LIMITS_SAMPLE=1` | Use fake sample data |
| `PLAN_LIMITS_CODEX_DIR` | Codex home directory; defaults to `CODEX_HOME`, then `~/.codex` |
| `PLAN_LIMITS_CODEX_BIN` | Codex executable; defaults to `codex` |
| `PLAN_LIMITS_DISABLE_CODEX_APP_SERVER=1` | Skip the live query and use only the rollout fallback |
| `CLAUDE_CONFIG_DIR` | Claude configuration directory |

The collector also notices `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
`CLAUDE_CODE_USE_BEDROCK=1`, and `AWS_PROFILE` so it can render those channels
without mislabeling them as subscription plans.

## API contract

`GET /api/usage/limits`

Returns:

```json
{
  "generatedAt": "2026-07-27T18:00:00.000Z",
  "services": [
    {
      "id": "codex-subscription",
      "name": "Codex",
      "plan": "ChatGPT Pro (20×)",
      "authMode": "subscription",
      "status": "live",
      "source": "codex-app-server",
      "observedAt": "2026-07-27T18:00:00.000Z",
      "windows": [
        {
          "label": "5h",
          "usedPct": 61,
          "resetsAt": "2026-07-27T21:00:00.000Z",
          "elapsedPct": 50,
          "pacePct": 122
        }
      ],
      "note": null
    }
  ]
}
```

Add `?refresh=1` to bypass the short-lived server cache.

## Putting it into another application

The package deliberately separates collection from presentation:

- `src/plan-usage.ts` — complete provider collection, normalization, caching,
  fallbacks, and TypeScript response types.
- `src/server.ts` — a tiny Node HTTP adapter and static-file server.
- `public/app.js` — framework-free rendering and refresh state.
- `public/styles.css` — all visual styling for the panel and demo page.
- `src/sample-data.ts` — safe fake data for design and integration work.
- `test/` — collector-contract and HTTP smoke tests.

An existing Node server usually needs only:

```ts
import { getPlanUsage } from "./plan-usage.js";

const data = await getPlanUsage(requestUrl.searchParams.get("refresh") === "1");
response.end(JSON.stringify(data));
```

The browser component only depends on the normalized JSON contract, so it can
be ported to React, Vue, Svelte, or another UI without moving credential access
into the browser.

## Prompt to give an implementation agent

You can hand an agent this entire folder and say:

> Integrate the Live Usage Plan Limits package into my application. Preserve
> `src/plan-usage.ts` as a server-only module, expose its normalized response at
> a same-origin API endpoint, and port the UI to my existing component and
> styling system. Never send credentials or raw provider responses to the
> browser. Keep sample mode for development and run the included typecheck and
> tests before finishing.

## Verification

```sh
npm run typecheck
npm test
```

The source was extracted from the Forge dashboard on 2026-07-27. The upstream
reference is:

- <https://github.com/stevebargelt/forge/blob/main/dashboard/src/plan-usage.ts>
- <https://github.com/stevebargelt/forge/blob/main/dashboard/client/usage-limits.js>
