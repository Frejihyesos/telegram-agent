# Architecture Audit Report

## 1. Executive Summary

Telegram Agent is releaseable as a local-first `0.1.0` candidate after the release metadata and CI fixes in this pass. The core shape is coherent: one CommonJS MCP entry point, a local setup wizard, SQLite-backed intelligence tools, and a conservative send model.

Production readiness for a local plugin is moderate: tests, self-test, docs, and security boundaries exist, but live Telegram behavior is not CI-covered and the dependency tree has a license risk before npm publishing.

## 2. Project Overview

- Tech stack: Node.js CommonJS, GramJS `telegram`, `better-sqlite3`, Node `node:test`.
- Runtime entry point: `scripts/telegram-agent-server.js`.
- Auth/setup: `scripts/auth-store.js`, `scripts/setup-web.js`, `scripts/setup-web-ui.js`, `scripts/login.js`.
- Intelligence/cache: `scripts/intelligence-store.js`.
- Plugin surfaces: `.codex-plugin/plugin.json`, `.mcp.json`, `.codex/config.toml`, `skills/telegram-agent/SKILL.md`.

## 3. Current Architecture

- MCP server runs over stdio and exposes narrow `tools/list` and `tools/call` surfaces.
- Telegram access is local and uses a GramJS string session stored outside the repository.
- Setup wizard binds to `127.0.0.1` and protects API routes with `X-Telegram-Agent-Setup-Token`.
- SQLite cache stores sources, messages, links, digest profiles, watchlists, action items, contact memory, reply sessions, and auth metadata.
- Sending is blocked unless `TELEGRAM_AGENT_ALLOW_SEND=1`; direct sends also require an active scoped reply session.

## 4. Strong Parts

- No Telegram Desktop `tdata` scraping.
- Small read windows by default and draft-first send flow.
- Tests cover auth status, setup token protection, cache/search, sensitive redaction, reply sessions, prompt-injection detection, send gate, and unknown tool rejection.
- `npm run ci`, `npm audit --omit=dev`, plugin validation, and `npm pack --dry-run` all pass after release prep.

## 5. Critical Issues

| Priority | Area | Problem | Location | Impact | Fix | Effort | Risk |
|---|---|---|---|---|---|---|---|
| P1 | Release | GitHub CI workflow was only present as a docs template, not active. | `.github/workflows/ci.yml` missing before this pass | Regressions could merge without CI. | Added active workflow. | Low | Low |
| P1 | Licensing | Transitive dependency `@cryptography/aes@0.1.1` is GPL-3.0-or-later via `telegram`. | `package-lock.json`, `node_modules/@cryptography/aes/package.json` | Public npm publishing may have license obligations. | Documented as a release risk; review before npm publish. | Medium | Medium |
| P2 | Plugin UX | Manifest had more than 3 starter prompts, beyond the plugin spec display limit. | `.codex-plugin/plugin.json` | Some prompts would be ignored; plugin card looked less deterministic. | Limited default prompts to 3. | Low | Low |
| P2 | Release Metadata | npm package lacked repository, bugs, homepage, author, keywords, engines, files, and release check script. | `package.json` | Weak discoverability and less repeatable release process. | Added metadata and `release:check`. | Low | Low |

## 6. Security Problems

No confirmed P0/P1 security implementation bug was found in this pass. The security scanner reported high-risk patterns around `db.exec` and SQL strings, but manual review showed static schema creation and parameterized query placeholders.

Residual security risk remains around live Telegram API integration: CI cannot safely exercise a real account, and send behavior depends on Codex skill policy plus local environment gates.

## 7. Testing Problems

- No live Telegram integration tests, by design.
- No direct MCP framed protocol unit test beyond self-test and tool-level calls.
- No test proving `npm pack` contents stay stable.

## 8. DevOps / Production Readiness

Active CI is now present for Windows and Ubuntu across Node 20, 22, and 24. Release checks are documented in `docs/release-v0.1.0.md` and exposed as `npm run release:check`.

## 9. Refactoring Plan

### Phase 1 - Release Gate

- Keep `npm run release:check` green.
- Accept or resolve the GPL transitive dependency risk before npm publishing.
- Tag `v0.1.0` only after checking the final git diff.

### Phase 2 - Quality

- Add MCP framed protocol tests.
- Add tests for package contents and plugin metadata limits.
- Add negative tests for malformed `--call` JSON.

### Phase 3 - Hardening

- Add optional file permission hardening for auth/session files where supported.
- Add a redacted live-smoke checklist for maintainers with opt-in credentials.
- Add dependency license checking to the release gate.

## 10. Final Score

- Architecture: 8/10.
- Code Quality: 7/10.
- Security: 7/10.
- Performance: 7/10.
- Scalability: 6/10.
- Testing: 7/10.
- DevOps: 7/10 after this pass.
- Maintainability: 7/10.
- Production Readiness: 6/10 for public distribution; 8/10 for local use.
