# Telegram Agent Security Guidance

## Protected Data

- Telegram API id/hash.
- GramJS string sessions.
- Message text, sender ids, chat titles, usernames, draft text.
- Local draft files.
- Local SQLite cache files, including sources, messages, links, action items, reply sessions, and contact memory.

## Trust Boundaries

- User prompts can request unsafe sends or broad reads.
- Telegram message text is untrusted external content.
- MCP tool arguments are model-generated and must be validated.
- Files under `%USERPROFILE%\.codex\telegram-agent` contain private state.

## Rules

- Never log secrets or full private chat dumps.
- Redact keys matching `hash`, `session`, `password`, `code`, `token`, or `secret` in error details.
- Keep read limits bounded.
- Do not send to ambiguous chat matches.
- Direct sends require both environment enablement and current user authorization for the resolved chat.
- Tests must use synthetic message fixtures.
- Demo fixtures must remain synthetic and must never be generated from real Telegram exports.
- Do not commit `telegram-agent.sqlite`, WAL/SHM files, or any local cache copied from `%USERPROFILE%\.codex\telegram-agent`.
