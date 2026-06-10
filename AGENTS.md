# AGENTS.md

## Project Identity

Telegram Agent is a local Codex plugin and MCP server for Telegram inbox triage, dialog lookup, selected-chat context, message search, SQLite-backed digests/search/watchlists, maintainer intelligence, local reply drafts, scoped reply sessions, and explicitly authorized sends. It is a CommonJS Node.js project.

## Runtime Map

- MCP entry point: `scripts/telegram-agent-server.js`.
- Intelligence/cache module: `scripts/intelligence-store.js`.
- Demo entry point: `scripts/demo.js`.
- Login entry point: `scripts/login.js`.
- Codex plugin manifest: `.codex-plugin/plugin.json`.
- MCP server config: `.mcp.json` and `.codex/config.toml`.
- Skill instructions loaded by Codex: `skills/telegram-agent/SKILL.md`.

The MCP server runs over stdio, implements `initialize`, `tools/list`, and `tools/call`, and returns tool output as JSON text content.

## Directory Map

- `scripts/`: first-party runtime and login code.
- `fixtures/`: synthetic demo sources/messages; no real Telegram data.
- `skills/`: Codex skill instructions for safe Telegram tool usage.
- `.codex-plugin/`: plugin manifest consumed by Codex plugin install/cache.
- `.codex/`: local Codex MCP config for this plugin.
- `.github/`: GitHub Actions workflows.
- `test/`: Node `node:test` unit tests.
- `node_modules/`: vendored dependencies from `npm install`; do not edit.

## Core Architecture

`scripts/telegram-agent-server.js` owns:

- MCP tool schemas;
- Telegram client loading/caching;
- dialog and entity summaries;
- message normalization and chat stats;
- draft file creation/list/delete/send;
- direct send gate via `TELEGRAM_AGENT_ALLOW_SEND`;
- JSON-RPC framing over stdio.

`scripts/intelligence-store.js` owns:

- local SQLite schema and migrations;
- source/message/link cache;
- FTS-backed cached search;
- digest profiles, watchlists, dedupe clusters, and source ranking;
- needs-reply/action/follow-up/weekly-report analysis;
- reply sessions and contact memory.

`scripts/login.js` owns QR and phone-code login and writes the local GramJS session.

## Data And Storage

Default local state lives in `%USERPROFILE%\.codex\telegram-agent`:

- `config.json`: Telegram API id/hash.
- `session.txt`: GramJS string session.
- `drafts/*.json`: local reply drafts.
- `telegram-agent.sqlite`: cached sources/messages/links, digest profiles, watchlists, action items, reply sessions, contact memory, and mirrored audit events.

Never copy these values into source, issues, tests, logs, or docs. The repository must not include real Telegram messages or credentials.

## Build And Run Workflow

Verified commands:

- `npm install`
- `npm run login:qr`
- `npm run status`
- `npm run check`
- `npm test`
- `npm run self-test`
- `npm run ci`
- `npm run demo:digest`
- `npm run demo:needs-reply`
- `npm run demo:weekly-report`

## Working Rules

- Start with `scripts/telegram-agent-server.js` for tool behavior changes.
- Start with `scripts/intelligence-store.js` for cache, digest, watchlist, research, and maintainer intelligence behavior.
- Update `skills/telegram-agent/SKILL.md` whenever agent workflow or send rules change.
- Update README/tool docs when adding or removing MCP tools.
- Keep sending conservative: draft-first by default, direct-send only for explicitly authorized resolved chats.
- Do not reintroduce Telegram Desktop `tdata` handling into the public project.

## Risks And Caveats

- Telegram API calls may hit rate limits; tests must avoid live writes.
- `TELEGRAM_AGENT_ALLOW_SEND=1` enables send tools, but policy still lives in skill instructions and tool arguments.
- Ambiguous chat names are a real safety risk; resolve with `telegram_find_dialogs` before sending.
- The Codex app may use a cached plugin version until cachebuster/reinstall/new thread refreshes it.
