# OpenAI Codex for OSS Application Draft

## Project

Telegram Agent for Codex

## Repository

https://github.com/Frejihyesos/telegram-agent

## Short Description

Telegram Agent is a local, privacy-first MCP server and Codex plugin that helps open-source maintainers triage Telegram chats, inspect context, search messages, draft replies, and send explicitly authorized responses without running a hosted relay.

## Problem Solved

Many open-source communities coordinate important work in Telegram: release testing, bug reports, support requests, contributor coordination, and urgent incident follow-up. Maintainers often miss questions because context is spread across multiple chats and private messages.

Telegram Agent gives AI coding assistants a narrow, auditable, local interface to that communication surface. It helps maintainers answer faster while keeping credentials and message data on the user's machine.

## Current Metrics

- MCP tools: 43.
- Unit tests: 20 passing with Node's built-in test runner.
- CI matrix: Windows and Ubuntu across Node 20, 22, and 24.
- Dependency audit: 0 known production vulnerabilities from `npm audit --omit=dev`.
- Runtime dependencies: 5 direct packages after adding SQLite cache support and local QR SVG generation.
- Security posture: local-only session/cache storage, browser setup bound to `127.0.0.1`, per-process setup token, send disabled by default, explicit send gate, scoped reply sessions, local audit log, no Telegram Desktop `tdata` parsing.

Launch metrics to update after publication:

- GitHub stars.
- GitHub forks.
- GitHub issues/PRs.
- Users/testers.
- Demo views.
- Install attempts or package downloads if published to npm later.

## Why The Project Matters To OSS

Open-source maintainers increasingly use chat platforms as part of their support and release workflow, but those platforms are hard to integrate with coding agents safely. Telegram Agent focuses on a common maintainer problem: extracting actionable context from Telegram without giving an assistant unrestricted account control.

The project is useful for maintainers who coordinate:

- beta testing groups;
- release coordination;
- user support;
- contributor questions;
- incident follow-up;
- project community chats.

## How OpenAI Access Helps

ChatGPT Pro, Codex, Codex Security, and API credits would help develop the project in several concrete ways:

- improve smarter maintainer triage tools such as `telegram_needs_reply`, topic digests, watchlists, GitHub issue drafts, prompt-injection detection, and weekly maintainer reports;
- generate safer reply drafts that account for chat history and project context;
- review send-policy changes with security tooling before release;
- create regression tests and synthetic fixtures for private-message workflows;
- benchmark cached search and summarization quality;
- improve browser-based local onboarding and examples for multiple MCP clients;
- keep the project maintained through issue triage, PR review, and release notes.

## Six-Month Roadmap

1. Benchmark SQLite cache and FTS5 search against direct Telegram API search.
2. Improve topic digest quality and source reputation on opt-in real-world fixtures.
3. Add per-chat policy files for safer autonomous reply sessions.
4. Add a short demo video showing the local setup wizard, prompt-injection shield, issue drafts, and synthetic fixtures.
5. Publish package/install templates for more MCP clients.
6. Add release signing and security review automation.

## Suggested Form Answer

Telegram Agent is a local MCP server and Codex plugin for privacy-first Telegram workflow assistance. It helps open-source maintainers triage Telegram-based contributor and community communication: browser-based local setup, unread briefs, dialog search, selected-chat context, SQLite cache search, topic digests, watchlists, action extraction, prompt-injection detection, GitHub issue draft generation, Codex-ready maintainer context packs, weekly maintainer reports, local drafts, scoped direct sends, and local audit logs.

The project solves a real maintainer problem: OSS work often happens across GitHub and Telegram, but assistants need a narrow and safe interface before they can help. Telegram Agent keeps Telegram credentials and messages local, disables sending by default, and only allows direct sends for explicitly authorized resolved chats.

OpenAI access would help me build maintainer-focused tools like `telegram_needs_reply`, `telegram_maintainer_brief`, cached semantic triage, safer reply drafting, regression tests, and security review workflows for MCP tool changes.
