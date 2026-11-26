# gauge

A local dashboard for the Claude Code and Codex **plan limits** on this Mac:
one dial per window (5-hour, weekly, per-model weekly) with how much is used,
when it resets, and the pace you're on. It runs at login and lives at
<http://127.0.0.1:4312>.

gauge reads the sign-ins Claude Code and Codex already use. It shows only what
it observed: a source that fails says so, and API-key and Bedrock services are
listed without invented limits.

## Run it

Requirements: Node.js 20 or newer, and Chrome for the browser tests.

```sh
npm ci
npm run sample   # fake data; reads no credentials
npm start        # this Mac's live sign-ins
```

### At login

```sh
bin/install-login-agent     # install and start; run it from ~/code/gauge
bin/uninstall-login-agent   # stop and remove
```

The agent restarts gauge if it exits, and logs to `~/Library/Logs/gauge/gauge.log`.
It records the `node` and `PATH` from the shell you install it from. Re-run the
install after changing Node versions, or after moving `codex` or `claude`.
`bin/install-login-agent --print` shows the definition without installing.

## Where the readings come from

### Claude Code

gauge looks for Claude Code's OAuth credential in:

1. `$CLAUDE_CONFIG_DIR/.credentials.json`, when `CLAUDE_CONFIG_DIR` is set;
2. otherwise `~/.claude/.credentials.json`;
3. on macOS, the `Claude Code-credentials` Keychain item.

The server sends the token to the Anthropic usage endpoint that Claude Code
itself uses (`/api/oauth/usage`). Anthropic does not document that endpoint, so
it can change. If it does, the Claude service shows an error.

### Codex

gauge starts `codex app-server --stdio` and calls `account/rateLimits/read`.
If that does not return a usable result, gauge falls back to the latest
rate-limit record in the recent rollout files under `~/.codex/sessions`, and
marks that reading stale.

### API keys and Bedrock

`ANTHROPIC_API_KEY`, `OPENAI_API_KEY` and `CLAUDE_CODE_USE_BEDROCK=1` (with
`AWS_PROFILE`) are listed as services, so you can see which ones are in play.
These services are billed by use and have no plan limits.

## Security boundary

- The server binds to `127.0.0.1`.
- The API response and the page carry only plan names, percentages, reset
  times, status and notes. Credentials and raw provider responses stay in the
  server process.
- The page escapes provider text, uses a same-origin Content Security Policy,
  and the API response is `Cache-Control: no-store`.

## Configuration

| Environment variable | Purpose |
| --- | --- |
| `GAUGE_HOST` | Bind address; defaults to `127.0.0.1` |
| `GAUGE_PORT` | HTTP port; defaults to `4312` |
| `GAUGE_SAMPLE=1` | Serve fake sample data |
| `GAUGE_CODEX_DIR` | Codex home; defaults to `CODEX_HOME`, then `~/.codex` |
| `GAUGE_CODEX_BIN` | Codex executable; defaults to `codex` |
| `GAUGE_DISABLE_CODEX_APP_SERVER=1` | Skip the live Codex query; use only the rollout fallback |
| `CLAUDE_CONFIG_DIR` | Claude Code configuration directory |

## API

`GET /api/usage/limits` returns one entry per service. Add `?refresh=1` to skip
the server's 30-second cache.

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
        { "label": "5h", "usedPct": 61, "resetsAt": "2026-07-27T21:00:00.000Z", "elapsedPct": 50, "pacePct": 122 }
      ],
      "note": null
    }
  ]
}
```

`status` is one of `live`, `stale`, `unavailable`, `not_applicable`,
`not_configured` or `error`. `GET /health` returns `{"ok":true}`.

## Origin

gauge started as the "Live usage: plan limits & windows" panel of the Forge
dashboard. It was extracted on 2026-07-27, and continued here after Forge was
retired.
