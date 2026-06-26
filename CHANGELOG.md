# Changelog

## 0.1.0 - 2026-06-26

Initial public release candidate.

### Added

- Local MCP server for Telegram setup, inbox triage, dialog lookup, selected-chat context, message search, drafts, and explicitly authorized sends.
- Browser setup wizard bound to `127.0.0.1` with QR login, phone-code login, setup-token protected API routes, and local auth metadata.
- SQLite-backed source/message cache with FTS-backed search, digests, watchlists, trend detection, and maintainer reports.
- Personal productivity tools for smart inbox ranking, daily briefings, contact briefs, follow-ups, memory search, and redacted sensitive search.
- Prompt-injection detection over Telegram message text and GitHub issue draft generation from cached feedback.
- Node test suite, self-test command, release check command, and GitHub Actions CI on Windows and Ubuntu.

### Security Notes

- Telegram API credentials, GramJS sessions, drafts, audit events, and SQLite cache live under the local user data directory by default.
- Sending is gated by `TELEGRAM_AGENT_ALLOW_SEND=1`, draft confirmation, scoped reply sessions, and Codex skill policy.
- The project does not read Telegram Desktop `tdata`.

### Known Release Risks

- The npm dependency tree includes `@cryptography/aes@0.1.1` with `GPL-3.0-or-later` via `telegram@2.26.22`; review license obligations before npm publishing or redistribution.
- Live Telegram API behavior is only smoke-checkable with an authorized local account and may hit Telegram rate limits.
