# Security Policy

Telegram Agent handles private messages and Telegram API credentials. Treat every change as security-sensitive.

## Supported Versions

The project is pre-1.0. Security fixes target the latest `main` branch.

## Reporting a Vulnerability

Do not open a public issue with secrets, private chat logs, session strings, API hashes, or reproduction data that exposes another person.

For now, open a private GitHub security advisory if available on the repository, or contact the maintainer privately. Include:

- affected version or commit;
- what data or action is exposed;
- safe reproduction steps without real private chats;
- whether sending can be triggered or credentials can leak.

## Security Boundaries

- Telegram API credentials and sessions are stored outside the repository.
- The MCP server is local and communicates over stdio.
- The browser setup wizard binds to `127.0.0.1` and protects API routes with a per-process setup token.
- Login codes and Telegram 2FA passwords are never stored.
- Sending is disabled unless `TELEGRAM_AGENT_ALLOW_SEND=1`.
- Direct send tools require explicit user authorization for the resolved chat.
- Telegram message text is treated as untrusted content and can be scanned for prompt-injection attempts.
- The public project does not read Telegram Desktop `tdata`.

## Maintainer Checklist

- Never commit `%USERPROFILE%\.codex\telegram-agent`.
- Never paste real session strings into issues or tests.
- Never log setup tokens, API hashes, login codes, 2FA passwords, or full session strings.
- Prefer fixtures with fake entity ids and message text.
- Add tests for send gates and authorization checks before changing send behavior.
- Add tests for prompt-injection handling before changing how Telegram text influences actions.
- Run `npm run ci` and the security pattern scan before release.
