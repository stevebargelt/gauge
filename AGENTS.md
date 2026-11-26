# gauge

A local dashboard for this Mac's Claude Code and Codex **plan limits**. Read `GLOSSARY.md` for the domain words; `README.md` covers sources, configuration and the API contract. Commands are the `package.json` scripts.

## Live credentials are the owner's

The collector reads the owner's Claude Code login (credentials file or macOS Keychain) and runs their `codex`. Work against fixtures and sample mode (`npm run sample`):

- Test through the seams: `collectPlanUsage` options, `createAppServer({ collector })`, and the browser tests, which serve the page from `createAppServer` with stubbed collector sources.
- Leave `npm start`, `GET /api/usage/limits` without a stubbed collector, and `bin/install-login-agent` to the owner. Each one reads live credentials.

## Rules the code keeps

- A reading is observed or absent. When a source fails or has nothing, the service says so (`error`, `unavailable`, `stale`, `not_configured`); it never shows 0% or an estimate.
- Credentials and raw provider responses stay in the server process: out of the API response, the page, logs and error text.
- The server binds to loopback.

## Tests

`npm test` runs the collector and server tests. `npm run test:browser` runs the page tests and needs Chrome (or `CHROME_PATH`); run both before a PR.

## Login agent

`bin/install-login-agent` points launchd at the clone it is run from, so it is run from `~/code/gauge`, never a worktree. `--print` shows the definition without installing.
