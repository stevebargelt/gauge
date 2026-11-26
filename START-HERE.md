# Start here

This folder is a complete mini-application. It displays the current usage
windows for Claude Code and Codex accounts already signed in on your computer.

## Just see the dashboard with fake data

1. Install Node.js 20 or newer from <https://nodejs.org/>.
2. Open a terminal in this folder.
3. Run:

```sh
npm install
npm run sample
```

4. Open <http://127.0.0.1:4312> in a browser.

## Show your real accounts

Sign into Claude Code and/or Codex normally, then run:

```sh
npm start
```

The application reads the local sign-in state used by those tools. It does not
ask you to paste a token into the browser.

## Ask an agent to add it to your project

Give the agent this whole folder and say:

```text
Integrate this Live Usage Plan Limits mini-application into my project. Read
README.md first. Keep the collector on the server, expose only its normalized
JSON response to the browser, and port the panel to my existing UI framework.
Do not expose credentials or raw provider responses. Preserve sample mode and
run the supplied typecheck and tests.
```

`README.md` contains the full technical explanation, security boundary, API
contract, configuration, and file map.
