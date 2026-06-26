# Telegram Agent 0.1.0 Release Notes

Date: 2026-06-26

## Summary

`telegram-agent@0.1.0` is the first local-first release of the Codex Telegram Agent plugin and MCP server. It provides Telegram setup, compact inbox reads, selected chat context, message search, local drafts, explicitly authorized sends, SQLite-backed digests, maintainer reports, personal briefings, and prompt-injection detection without a hosted relay.

## Release Gate

Run before tagging:

```powershell
npm run release:check
python C:/Users/User/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py C:/Users/User/plugins/telegram-agent
python C:/Users/User/.codex/skills/secure-coding-guardrails/scripts/security_pattern_scan.py --changed
```

Expected results for this release candidate:

- `npm run ci`: pass.
- `npm audit --omit=dev`: no vulnerabilities.
- `npm pack --dry-run`: package builds as `telegram-agent-0.1.0.tgz`.
- Plugin validation: pass.
- Changed-file security scan: only workflow-change review signal.
- Full security scan note: known high findings around static SQLite schema creation and parameterized SQL statements were manually reviewed as false positives.

## Notable Risks

- License review is needed before npm publishing or redistribution because the `telegram` dependency currently pulls `@cryptography/aes@0.1.1` with `GPL-3.0-or-later`.
- Live Telegram reads/sends are intentionally not part of CI because they require a user account and can trigger Telegram rate limits.
- Local auth files are outside the repository, but users must still protect `%USERPROFILE%\.codex\telegram-agent`.

## Release Steps

```powershell
npm run release:check
git status --short
git tag -a v0.1.0 -m "Release v0.1.0"
```

Publishing to GitHub or npm should happen only after the license risk above is explicitly accepted.
