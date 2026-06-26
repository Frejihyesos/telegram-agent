# Telegram Agent for Codex

Privacy-first Telegram tools for Codex and other MCP clients.

Telegram Agent is a local MCP server and Codex plugin that helps maintainers and ordinary users triage Telegram chats, inspect reply-ready context, search messages as local memory, build personal briefings, draft responses, and send explicitly authorized messages without running a cloud relay.

## Why It Exists

Many open-source projects coordinate releases, bug reports, testers, and contributors in Telegram. That creates a messy support surface for maintainers: urgent questions get buried, context is spread across chats, and AI assistants need a safe way to help without leaking private messages or sending uncontrolled replies.

Telegram Agent solves that by keeping the Telegram API session on the user's machine and exposing narrow MCP tools for:

- unread inbox briefs;
- dialog lookup;
- selected-chat context;
- message search;
- local reply drafts;
- controlled direct sends to explicitly authorized chats.
- personal command-center tools for smart inbox ranking, daily digests, follow-ups, contact briefs, local memory search, and secret-safe search.

## Safety Model

- Local first: no hosted backend and no third-party relay.
- Read-scoped by default: tools fetch small windows unless the user asks for more.
- Draft-first replies: normal replies are saved as local drafts before sending.
- Explicit send gate: sending requires `TELEGRAM_AGENT_ALLOW_SEND=1`.
- Contact-scoped autonomy: direct sends are only for a resolved chat that the user explicitly authorized in the current task.
- Secret-safe user tools: personal search and digest surfaces redact passwords, tokens, codes, and key-like values by default; values are included only when explicitly requested with an authorization basis.
- No Telegram Desktop scraping: the public project does not read, request, parse, copy, or convert Telegram Desktop `tdata`.
- Secrets stay outside the repo in `%USERPROFILE%\.codex\telegram-agent`.

## Install

```powershell
cd path\to\telegram-agent
npm install
npm run setup
npm run status
```

`npm run setup` starts a local browser wizard on `127.0.0.1`. It lets you save the Telegram API id/hash, choose QR login or phone-code login, and see the local state paths after authorization.

QR login is preferred. In Telegram mobile, open **Settings > Devices > Link Desktop Device** and scan the browser QR code.

Terminal fallback commands are also available:

```powershell
npm run login:qr
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
- `%USERPROFILE%\.codex\telegram-agent\telegram-agent.sqlite`: local source/message cache, digest profiles, watchlists, action items, contact memory, reply sessions, and auth metadata.

The setup wizard never stores a Telegram 2FA password. SQLite stores auth status, account summary, fingerprints, and events, but not the API hash or full GramJS session.

Delete that directory to remove local Telegram Agent state. To fully revoke the Telegram API session, also remove the session from Telegram settings.

## MCP Tools

- `telegram_setup_status`: check credentials, session, dependencies, and send mode.
- `telegram_auth_status`: inspect local auth setup status without connecting to Telegram.
- `telegram_start_setup`: start the local browser setup wizard and return its URL.
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
- Cache and search: `telegram_sync_sources`, `telegram_sync_recent_messages`, `telegram_cache_status`, `telegram_search_cached_messages`.
- Digests: `telegram_suggest_sources`, `telegram_rank_sources`, `telegram_create_digest_profile`, `telegram_list_digest_profiles`, `telegram_run_digest`, `telegram_run_topic_digest`, `telegram_explain_digest_cluster`.
- Maintainer intelligence: `telegram_needs_reply`, `telegram_extract_actions`, `telegram_followup_tracker`, `telegram_weekly_maintainer_report`.
- OSS maintainer bridge: `telegram_detect_prompt_injection`, `telegram_create_github_issue_drafts`, `telegram_build_maintainer_context`.
- Personal productivity: `telegram_daily_personal_digest`, `telegram_smart_inbox`, `telegram_memory_search`, `telegram_contact_brief`, `telegram_personal_followups`, `telegram_sensitive_search`, `telegram_personal_briefing`.
- Watchlists and research: `telegram_create_watchlist`, `telegram_list_watchlists`, `telegram_run_watchlist`, `telegram_research_topic`, `telegram_detect_trends`.
- Safe autonomy: `telegram_start_reply_session`, `telegram_reply_session_status`, `telegram_stop_reply_session`, `telegram_contact_context`.

## Maintainer Workflow

1. Use `telegram_inbox_brief` for a compact unread overview.
2. Use `telegram_find_dialogs` to resolve a person or group.
3. Use `telegram_chat_context` for reply-ready context and pending-message stats.
4. Use `telegram_create_draft` for normal proposed replies.
5. Use `telegram_send_message` only in an explicitly authorized ongoing chat task.

## Digest Workflow

1. Run `telegram_sync_sources`.
2. Run `telegram_sync_recent_messages` for selected sources or categories.
3. Use `telegram_suggest_sources` for a phrase such as `AI`, `Codex`, `MCP`, `work`, or `support`.
4. Use `telegram_run_topic_digest` for one-off digests or `telegram_create_digest_profile` plus `telegram_run_digest` for recurring digests.
5. Ask Codex to turn the structured clusters into final prose with source refs and message refs.

## Development

```powershell
npm run check
npm test
npm run self-test
npm run ci
npm run release:check
npm run demo:digest
npm run demo:needs-reply
npm run demo:weekly-report
npm run demo:prompt-injection
npm run demo:issue-drafts
npm run demo:context
npm run demo:oss-report
npm run demo:personal-digest
npm run demo:smart-inbox
npm run demo:memory-search
npm run demo:contact-brief
npm run demo:personal-followups
npm run demo:sensitive-search
npm run demo:personal-briefing
```

The test suite uses Node's built-in `node:test` runner and avoids live Telegram writes.

The demo commands use synthetic fixtures only; they do not require Telegram credentials.

The repository includes an active pinned GitHub Actions workflow at `.github/workflows/ci.yml` and a copyable template at [docs/ci-github-actions.yml](./docs/ci-github-actions.yml).

## Release

The first release is `0.1.0`. Before tagging or publishing, run:

```powershell
npm run release:check
```

Also review [docs/dependency-license-notes.md](./docs/dependency-license-notes.md): the locked dependency tree currently includes `@cryptography/aes@0.1.1` with `GPL-3.0-or-later` via `telegram@2.26.22`.

## Project Status

This project is early but usable locally. The `0.1.0` release includes:

- SQLite cache with FTS5 for fast local search;
- local browser setup wizard with QR and phone-code login;
- topic digests with source suggestions and dedupe clusters;
- maintainer-focused needs-reply, action extraction, follow-up tracking, and weekly reports;
- prompt-injection detection over untrusted Telegram text;
- GitHub issue draft generation from Telegram bug reports and feature requests;
- compact maintainer context packs for Codex;
- ordinary-user personal briefing, smart inbox, contact briefs, follow-up tracking, memory search, and secret-safe search;
- watchlists, research mode, trend detection, scoped reply sessions, and contact memory;
- sanitized demo fixtures;

Next milestones:

- benchmark numbers;
- install examples for more MCP clients.

See [ROADMAP.md](./ROADMAP.md) for the full plan.

## OSS Support Pitch

For grant or OSS-support submissions, see [docs/OPENAI_OSS_APPLICATION.md](./docs/OPENAI_OSS_APPLICATION.md).

## License

MIT. See [LICENSE](./LICENSE).
