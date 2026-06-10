# Telegram Agent for Codex

Privacy-first Telegram tools for Codex and other MCP clients.

Telegram Agent is a local MCP server and Codex plugin that helps maintainers triage Telegram chats, inspect reply-ready context, search messages, draft responses, and send explicitly authorized messages without running a cloud relay.

## Why It Exists

Many open-source projects coordinate releases, bug reports, testers, and contributors in Telegram. That creates a messy support surface for maintainers: urgent questions get buried, context is spread across chats, and AI assistants need a safe way to help without leaking private messages or sending uncontrolled replies.

Telegram Agent solves that by keeping the Telegram API session on the user's machine and exposing narrow MCP tools for:

- unread inbox briefs;
- dialog lookup;
- selected-chat context;
- message search;
- local reply drafts;
- controlled direct sends to explicitly authorized chats.

## Safety Model

- Local first: no hosted backend and no third-party relay.
- Read-scoped by default: tools fetch small windows unless the user asks for more.
- Draft-first replies: normal replies are saved as local drafts before sending.
- Explicit send gate: sending requires `TELEGRAM_AGENT_ALLOW_SEND=1`.
- Contact-scoped autonomy: direct sends are only for a resolved chat that the user explicitly authorized in the current task.
- No Telegram Desktop scraping: the public project does not read, request, parse, copy, or convert Telegram Desktop `tdata`.
- Secrets stay outside the repo in `%USERPROFILE%\.codex\telegram-agent`.

## Install

```powershell
cd path\to\telegram-agent
npm install
npm run login:qr
npm run status
```

QR login is preferred. In Telegram mobile, open **Settings > Devices > Link Desktop Device** and scan the terminal QR code.

Phone code login is also available:

```powershell
npm run login
```

Telegram may apply long `FLOOD_WAIT` limits after repeated phone-code requests.

## Enable Sending

By default, sending is disabled. To allow send tools for a Codex-launched MCP server, configure:

```json
{
  "env": {
    "TELEGRAM_AGENT_ALLOW_SEND": "1"
  }
}
```

The local plugin config in this repo already sets that value for the `telegram-agent` MCP server. Even with sending enabled, the agent rules still limit direct sends to a chat that the user explicitly authorized.

## Data Stored Locally

- `%USERPROFILE%\.codex\telegram-agent\config.json`: Telegram API id/hash.
- `%USERPROFILE%\.codex\telegram-agent\session.txt`: GramJS string session.
- `%USERPROFILE%\.codex\telegram-agent\drafts\`: unsent local reply drafts.

Delete that directory to remove local Telegram Agent state. To fully revoke the Telegram API session, also remove the session from Telegram settings.

## MCP Tools

- `telegram_setup_status`: check credentials, session, dependencies, and send mode.
- `telegram_me`: show the authorized Telegram account summary.
- `telegram_list_dialogs`: list recent dialogs with optional unread filtering.
- `telegram_find_dialogs`: search dialogs by title, username, id, or ref.
- `telegram_inbox_brief`: collect unread/recent chats with compact message snippets.
- `telegram_recent_messages`: fetch recent messages from one selected chat.
- `telegram_chat_context`: fetch a selected chat with stats, pending incoming count, questions, priority terms, and messages.
- `telegram_search_chat_messages`: search within one selected chat.
- `telegram_create_draft`: save a reply draft without sending it.
- `telegram_list_drafts`: list pending local drafts.
- `telegram_recent_audit_events`: inspect local draft/send audit events without full message text.
- `telegram_delete_draft`: delete one pending draft.
- `telegram_send_draft`: send a reviewed saved draft.
- `telegram_send_message`: send one direct message when sending is enabled and the user explicitly authorized that resolved chat.

## Maintainer Workflow

1. Use `telegram_inbox_brief` for a compact unread overview.
2. Use `telegram_find_dialogs` to resolve a person or group.
3. Use `telegram_chat_context` for reply-ready context and pending-message stats.
4. Use `telegram_create_draft` for normal proposed replies.
5. Use `telegram_send_message` only in an explicitly authorized ongoing chat task.

## Development

```powershell
npm run check
npm test
npm run self-test
npm run ci
```

The test suite uses Node's built-in `node:test` runner and avoids live Telegram writes.

## Project Status

This project is early but usable locally. The next high-impact milestones are:

- SQLite cache with FTS5 for fast local search;
- maintainer-focused `telegram_needs_reply` and `telegram_maintainer_brief` tools;
- sanitized demo fixtures and benchmark numbers;
- install examples for more MCP clients.

See [ROADMAP.md](./ROADMAP.md) for the full plan.

## License

MIT. See [LICENSE](./LICENSE).
