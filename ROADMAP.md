# Roadmap

## 0.2.0: OSS Foundation

- Durable unit tests for MCP protocol handling, send gates, and chat stats.
- GitHub Actions CI on Windows and Ubuntu.
- Public security policy and contribution guide.
- Sanitized fixtures for demo screenshots and reproducible tests.

## 0.3.0: Speed Layer

- SQLite cache under the local data directory. (done)
- Incremental dialog/message sync. (done)
- FTS5 search over cached messages. (done)
- Benchmarks comparing cached search with direct Telegram API search.

## 0.4.0: Maintainer Intelligence

- `telegram_needs_reply`: rank chats with unanswered incoming questions. (done)
- `telegram_weekly_maintainer_report`: summarize urgent contributor/tester/project chats. (done)
- Link extraction for GitHub issues, pull requests, releases, incidents, and deadlines. (done)
- Per-chat reply session policies built on the existing local audit log. (done)
- Next: benchmark and tune source scoring/dedupe quality on real-world opt-in fixtures.

## 0.5.0: Release Quality

- Signed release artifacts.
- MCP client examples beyond Codex.
- Demo video and sample redacted workflow.
- More granular consent and per-chat policy files.
