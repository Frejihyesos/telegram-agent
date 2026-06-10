# Contributing

Thanks for improving Telegram Agent.

## Local Setup

```powershell
npm install
npm run setup
npm run status
```

Live Telegram credentials are only needed for manual integration testing. Unit tests must not require a real Telegram account.

## Development Checks

```powershell
npm run check
npm test
npm run self-test
npm run ci
```

## Pull Request Expectations

- Keep private Telegram data out of commits, screenshots, fixtures, and logs.
- Add tests for send authorization, draft lifecycle, parsing, and MCP protocol changes.
- Update `README.md` and `skills/telegram-agent/SKILL.md` when tool behavior changes.
- Keep the default behavior conservative: read small windows, draft first, send only when explicitly authorized.

## Design Principles

- Local-first privacy beats convenience.
- One clear tool should map to one user intent.
- Ambiguous chat resolution must ask the user before sending.
- Bulk outreach, spam, harassment, evasion, or deceptive automation are out of scope.
