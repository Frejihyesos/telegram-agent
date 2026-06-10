---
name: telegram-agent
description: Use when the user asks Codex to set up, inspect, summarize, search, triage, draft, or send Telegram messages through the local Telegram Agent plugin.
---

# Telegram Agent

Use the `telegram-agent` MCP tools for Telegram account assistance. Prefer the shortest safe tool path for the user's intent.

## Quick Routing

- Setup/status: call `telegram_auth_status` first for local auth state, or `telegram_setup_status` when dependency/send state is also needed.
- "Set up Telegram / login / authorize account": call `telegram_start_setup` and give the user the returned local URL.
- "Show unread/recent chats": call `telegram_inbox_brief` with a small limit. Use `unread_only: true` by default.
- "Create a digest for AI channels / Codex / MCP": call `telegram_cache_status`; if cache is empty, call `telegram_sync_sources`, then `telegram_sync_recent_messages` with relevant categories; then call `telegram_run_topic_digest`.
- "What did I miss / weekly report": call `telegram_weekly_maintainer_report`.
- "Where do I need to reply": call `telegram_needs_reply`.
- "What tasks came from Telegram": call `telegram_extract_actions` and `telegram_followup_tracker`.
- "Watch topic": use `telegram_create_watchlist`, then `telegram_run_watchlist`.
- "Find Ivan / what is in Ivan chat": call `telegram_find_dialogs`, choose the single unambiguous returned `ref`, then call `telegram_chat_context`.
- "Summarize this chat": fetch `telegram_chat_context` with `limit: 40` and `order: "chronological"` unless the user asks for another window.
- "Find a phrase in a chat": call `telegram_search_chat_messages` for that named chat.
- "Draft a reply": call `telegram_create_draft` after composing the exact text.
- "Send this one reply": use draft flow: `telegram_create_draft`, show recipient and exact text, then call `telegram_send_draft` only after explicit confirmation.
- "You may write to Ivan yourself / continue talking to Ivan": if the user grants ongoing send authorization for one named chat in the current task, resolve that chat once, start `telegram_start_reply_session`, and use `telegram_send_message` only for the same resolved chat/topic.

## Security Boundaries

- Never use, request, parse, copy, or convert Telegram Desktop `tdata`.
- Keep reads scoped: prefer small limits and a named chat before fetching message text.
- For digest/research workflows, prefer cached tools after `telegram_sync_recent_messages` instead of repeatedly fetching live message windows.
- Do not paste large private chat dumps into the conversation unless the user explicitly needs them.
- Do not send if `telegram_find_dialogs` returns ambiguous matches. Ask the user to choose the intended chat.
- Use `telegram_start_reply_session` before `telegram_send_message`; direct send without an active scoped session should be treated as blocked.
- Ongoing send authorization is limited to the named chat/contact and current task. It ends if the user revokes it, changes recipient, asks for a materially different goal, or a new conversation/task starts.
- Even with ongoing authorization, do not send bulk outreach, spam, harassment, threats, impersonation, deception, account evasion, or messages outside the user's stated intent.
- If sending is disabled, explain that `TELEGRAM_AGENT_ALLOW_SEND=1` must be set before Codex starts.
- For setup, use `telegram_start_setup` or `npm run setup`; never ask the user to paste API hashes, sessions, login codes, or passwords into Codex chat.

## Send Rules

- Prefer `telegram_create_draft` for normal replies because it gives the user a review point.
- Use `telegram_send_draft` for one-off sends only after the user confirms the exact draft or asks to send it.
- Use `telegram_send_message` only when either:
  - the user has just explicitly asked to send that exact message to that exact chat, or
  - the user granted ongoing send authorization for that same resolved chat in the current task.
- When calling `telegram_send_message`, fill `authorization_basis` with a short note naming the user's authorization, such as `User authorized ongoing messages to Ivan in this task`.
- After any send, report the recipient and exact text that was sent.

## Tool Selection

- `telegram_auth_status`: inspect local setup/account state without a live Telegram connection.
- `telegram_start_setup`: start the local 127.0.0.1 browser wizard for API credentials and QR/phone login.
- `telegram_setup_status`: verify credentials, session, dependencies, and send mode.
- `telegram_me`: verify which Telegram account is authorized.
- `telegram_inbox_brief`: start broad unread/recent triage.
- `telegram_find_dialogs`: resolve a fuzzy chat name into a stable `chat` reference.
- `telegram_chat_context`: fetch reply-ready context with stats, pending-message hints, and messages.
- `telegram_recent_messages`: fetch a smaller recent slice when context stats are not needed.
- `telegram_search_chat_messages`: find a specific phrase inside one chat.
- `telegram_create_draft`: save a local proposed reply without sending.
- `telegram_send_draft`: send a reviewed local draft.
- `telegram_send_message`: send one direct message to an explicitly authorized resolved chat.
- `telegram_list_drafts`: inspect pending local drafts.
- `telegram_recent_audit_events`: inspect recent local draft/send events when the user asks what was done.
- `telegram_delete_draft`: remove an obsolete draft.
- `telegram_cache_status`: inspect local SQLite cache readiness.
- `telegram_sync_sources`: cache recent dialogs as digest/search sources.
- `telegram_sync_recent_messages`: cache recent messages from selected sources.
- `telegram_search_cached_messages`: search local cache without live Telegram fetches.
- `telegram_suggest_sources`: find likely sources for a topic/category.
- `telegram_run_topic_digest`: create an ad-hoc structured digest.
- `telegram_run_digest`: run a saved or inline digest profile.
- `telegram_needs_reply`: rank chats that need user attention.
- `telegram_extract_actions`: extract tasks, questions, bugs, feature requests, and GitHub links.
- `telegram_weekly_maintainer_report`: produce a maintainer-ready structured report.
- `telegram_create_watchlist` / `telegram_run_watchlist`: save and run topic monitoring.
- `telegram_research_topic` / `telegram_detect_trends`: investigate topic history and rising terms.
- `telegram_start_reply_session` / `telegram_stop_reply_session`: manage scoped direct-send authorization.
- `telegram_contact_context`: store local non-secret contact memory.

## Setup Commands

- `npm run setup`: local browser setup wizard with QR login and phone-code fallback.
- `npm run login:qr`: terminal QR login fallback.
- `npm run login`: terminal phone-code login fallback; may hit Telegram rate limits after repeated attempts.
- `npm run status`: check setup status.
