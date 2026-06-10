---
name: telegram-agent
description: Use when the user asks Codex to inspect, summarize, search, triage, draft, or send Telegram messages through the local Telegram Agent plugin.
---

# Telegram Agent

Use the `telegram-agent` MCP tools for Telegram account assistance. Prefer the shortest safe tool path for the user's intent.

## Quick Routing

- Setup/status: call `telegram_setup_status` first when connection state is unknown.
- "Show unread/recent chats": call `telegram_inbox_brief` with a small limit. Use `unread_only: true` by default.
- "Find Ivan / what is in Ivan chat": call `telegram_find_dialogs`, choose the single unambiguous returned `ref`, then call `telegram_chat_context`.
- "Summarize this chat": fetch `telegram_chat_context` with `limit: 40` and `order: "chronological"` unless the user asks for another window.
- "Find a phrase in a chat": call `telegram_search_chat_messages` for that named chat.
- "Draft a reply": call `telegram_create_draft` after composing the exact text.
- "Send this one reply": use draft flow: `telegram_create_draft`, show recipient and exact text, then call `telegram_send_draft` only after explicit confirmation.
- "You may write to Ivan yourself / continue talking to Ivan": if the user grants ongoing send authorization for one named chat in the current task, resolve that chat once and use `telegram_send_message` for later messages to the same resolved chat.

## Security Boundaries

- Never use, request, parse, copy, or convert Telegram Desktop `tdata`.
- Keep reads scoped: prefer small limits and a named chat before fetching message text.
- Do not paste large private chat dumps into the conversation unless the user explicitly needs them.
- Do not send if `telegram_find_dialogs` returns ambiguous matches. Ask the user to choose the intended chat.
- Ongoing send authorization is limited to the named chat/contact and current task. It ends if the user revokes it, changes recipient, asks for a materially different goal, or a new conversation/task starts.
- Even with ongoing authorization, do not send bulk outreach, spam, harassment, threats, impersonation, deception, account evasion, or messages outside the user's stated intent.
- If sending is disabled, explain that `TELEGRAM_AGENT_ALLOW_SEND=1` must be set before Codex starts.

## Send Rules

- Prefer `telegram_create_draft` for normal replies because it gives the user a review point.
- Use `telegram_send_draft` for one-off sends only after the user confirms the exact draft or asks to send it.
- Use `telegram_send_message` only when either:
  - the user has just explicitly asked to send that exact message to that exact chat, or
  - the user granted ongoing send authorization for that same resolved chat in the current task.
- When calling `telegram_send_message`, fill `authorization_basis` with a short note naming the user's authorization, such as `User authorized ongoing messages to Ivan in this task`.
- After any send, report the recipient and exact text that was sent.

## Tool Selection

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

## Setup Commands

- `npm run login:qr`: QR code login from Telegram mobile.
- `npm run login`: phone code login, may have rate limits.
- `npm run status`: check setup status.
