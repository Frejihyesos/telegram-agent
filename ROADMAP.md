# Roadmap

## 0.2.0: OSS Foundation

- Durable unit tests for MCP protocol handling, send gates, and chat stats.
- GitHub Actions CI on Windows and Ubuntu.
- Public security policy and contribution guide.
- Sanitized fixtures for demo screenshots and reproducible tests.

## 0.3.0: Speed Layer

- SQLite cache under the local data directory.
- Incremental dialog/message sync.
- FTS5 search over cached messages.
- Benchmarks comparing cached search with direct Telegram API search.

## 0.4.0: Maintainer Intelligence

- `telegram_needs_reply`: rank chats with unanswered incoming questions.
- `telegram_maintainer_brief`: summarize urgent contributor/tester/project chats.
- Link extraction for GitHub issues, pull requests, releases, incidents, and deadlines.
- Per-chat reply session policies built on the existing local audit log.

## 0.5.0: Release Quality

- Signed release artifacts.
- MCP client examples beyond Codex.
- Demo video and sample redacted workflow.
- More granular consent and per-chat policy files.
