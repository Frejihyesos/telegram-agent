#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const intelligence = require("./intelligence-store");

const DATA_DIR = process.env.TELEGRAM_AGENT_DATA_DIR || path.join(os.homedir(), ".codex", "telegram-agent");
const CONFIG_FILE = process.env.TELEGRAM_CONFIG_FILE || path.join(DATA_DIR, "config.json");
const SESSION_FILE = process.env.TELEGRAM_SESSION_FILE || path.join(DATA_DIR, "session.txt");
const DRAFT_DIR = process.env.TELEGRAM_DRAFT_DIR || path.join(DATA_DIR, "drafts");
const AUDIT_FILE = process.env.TELEGRAM_AUDIT_FILE || path.join(DATA_DIR, "audit.jsonl");
const MAX_MESSAGE_LIMIT = 100;
const MAX_DIALOG_LIMIT = 100;
const MAX_DRAFT_TEXT_LENGTH = 4096;

class TelegramAgentError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "TelegramAgentError";
    this.details = details;
  }
}

const TOOLS = [
  {
    name: "telegram_setup_status",
    description: "Check Telegram Agent dependencies, credentials, session file, and send mode.",
    inputSchema: {
      type: "object",
      properties: {
        check_connection: {
          type: "boolean",
          default: false,
          description: "When true, connect to Telegram and verify the session."
        }
      }
    }
  },
  {
    name: "telegram_me",
    description: "Return the currently authorized Telegram account summary.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "telegram_list_dialogs",
    description: "List recent Telegram dialogs without returning full message history.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: MAX_DIALOG_LIMIT, default: 20 },
        unread_only: { type: "boolean", default: false },
        query: { type: "string", description: "Optional title or username filter." }
      }
    }
  },
  {
    name: "telegram_find_dialogs",
    description: "Find Telegram dialogs by title, username, id, or ref and return agent-friendly chat references.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Title, username, id, or partial text to match." },
        scan_limit: { type: "integer", minimum: 1, maximum: 200, default: 100 },
        max_results: { type: "integer", minimum: 1, maximum: 50, default: 15 }
      },
      required: ["query"]
    }
  },
  {
    name: "telegram_inbox_brief",
    description: "Build a compact inbox bundle for Codex with unread/recent chats and optional message snippets.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 30, default: 10 },
        unread_only: { type: "boolean", default: true },
        include_messages: { type: "boolean", default: true },
        messages_per_chat: { type: "integer", minimum: 1, maximum: 10, default: 3 },
        incoming_only: { type: "boolean", default: true }
      }
    }
  },
  {
    name: "telegram_recent_messages",
    description: "Read recent messages from one selected Telegram chat.",
    inputSchema: {
      type: "object",
      properties: {
        chat: { type: "string", description: "Username, exact title, id, or 'me'." },
        limit: { type: "integer", minimum: 1, maximum: MAX_MESSAGE_LIMIT, default: 30 },
        include_outgoing: { type: "boolean", default: true },
        include_empty: { type: "boolean", default: false }
      },
      required: ["chat"]
    }
  },
  {
    name: "telegram_chat_context",
    description: "Fetch a selected chat as an agent-ready context bundle with stats, pending incoming count, questions, and messages.",
    inputSchema: {
      type: "object",
      properties: {
        chat: { type: "string", description: "Username, exact title, id, or 'me'." },
        limit: { type: "integer", minimum: 1, maximum: MAX_MESSAGE_LIMIT, default: 40 },
        include_outgoing: { type: "boolean", default: true },
        include_empty: { type: "boolean", default: false },
        order: {
          type: "string",
          enum: ["chronological", "latest_first"],
          default: "chronological"
        }
      },
      required: ["chat"]
    }
  },
  {
    name: "telegram_search_chat_messages",
    description: "Search messages inside one selected Telegram chat.",
    inputSchema: {
      type: "object",
      properties: {
        chat: { type: "string", description: "Username, exact title, id, or 'me'." },
        query: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: MAX_MESSAGE_LIMIT, default: 30 }
      },
      required: ["chat", "query"]
    }
  },
  {
    name: "telegram_create_draft",
    description: "Create a local Telegram reply draft. This never sends a message.",
    inputSchema: {
      type: "object",
      properties: {
        chat: { type: "string", description: "Username, exact title, id, or 'me'." },
        text: { type: "string", maxLength: MAX_DRAFT_TEXT_LENGTH },
        note: { type: "string", description: "Optional local note explaining the draft context." }
      },
      required: ["chat", "text"]
    }
  },
  {
    name: "telegram_list_drafts",
    description: "List pending local Telegram drafts created by Telegram Agent.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 100, default: 20 }
      }
    }
  },
  {
    name: "telegram_recent_audit_events",
    description: "List recent local audit events for draft and send actions without exposing full message text.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 100, default: 20 }
      }
    }
  },
  {
    name: "telegram_delete_draft",
    description: "Delete a pending local Telegram draft without sending it.",
    inputSchema: {
      type: "object",
      properties: {
        draft_id: { type: "string" }
      },
      required: ["draft_id"]
    }
  },
  {
    name: "telegram_send_draft",
    description: "Send a saved local Telegram draft. Requires TELEGRAM_AGENT_ALLOW_SEND=1 and exact confirmation phrase.",
    inputSchema: {
      type: "object",
      properties: {
        draft_id: { type: "string" },
        confirmation: {
          type: "string",
          description: "Must match the draft confirmation phrase returned by telegram_create_draft."
        }
      },
      required: ["draft_id", "confirmation"]
    }
  },
  {
    name: "telegram_send_message",
    description: "Send one Telegram message directly when the user has explicitly authorized sending to this resolved chat.",
    inputSchema: {
      type: "object",
      properties: {
        chat: { type: "string", description: "Username, exact title, id, or 'me'." },
        text: { type: "string", maxLength: MAX_DRAFT_TEXT_LENGTH },
        authorization_basis: {
          type: "string",
          description: "Short note naming the user's current authorization, e.g. 'User allowed ongoing messages to Ivan in this conversation'."
        }
      },
      required: ["chat", "text", "authorization_basis"]
    }
  }
];
TOOLS.push(...intelligence.INTELLIGENCE_TOOLS);

let telegramLib = null;
let cachedClient = null;
let cachedSessionKey = "";

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8").trim();
  } catch {
    return "";
  }
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function textFingerprint(text) {
  const normalized = String(text || "");
  return {
    text_length: normalized.length,
    text_sha256: crypto.createHash("sha256").update(normalized).digest("hex")
  };
}

function auditChat(chat) {
  if (!chat) return null;
  return {
    ref: chat.ref || null,
    id: chat.id || null,
    type: chat.type || null,
    title: chat.title || null,
    username: chat.username || null
  };
}

function appendAuditEvent(action, details = {}) {
  const event = {
    at: new Date().toISOString(),
    action,
    ...details
  };
  fs.mkdirSync(path.dirname(AUDIT_FILE), { recursive: true });
  fs.appendFileSync(AUDIT_FILE, `${JSON.stringify(event)}\n`, "utf8");
  intelligence.recordAuditEvent(action, event);
  return event;
}

function loadTelegramLib() {
  if (telegramLib) return telegramLib;
  try {
    const { TelegramClient } = require("telegram");
    const { StringSession } = require("telegram/sessions");
    telegramLib = { TelegramClient, StringSession };
    return telegramLib;
  } catch (error) {
    throw new TelegramAgentError("Telegram dependencies are not installed.", {
      kind: "dependency",
      advice: "Run `npm install` in C:\\Users\\User\\plugins\\telegram-agent."
    });
  }
}

function loadRuntimeConfig() {
  const config = readJson(CONFIG_FILE);
  const apiId = Number(process.env.TELEGRAM_API_ID || config.api_id || 0);
  const apiHash = String(process.env.TELEGRAM_API_HASH || config.api_hash || "").trim();
  const session = String(process.env.TELEGRAM_STRING_SESSION || readText(SESSION_FILE)).trim();

  if (!Number.isInteger(apiId) || apiId <= 0) {
    throw new TelegramAgentError("Telegram api_id is missing.", {
      kind: "setup",
      advice: "Run `npm run login:qr` or `npm run login` in C:\\Users\\User\\plugins\\telegram-agent, or set TELEGRAM_API_ID."
    });
  }
  if (!apiHash) {
    throw new TelegramAgentError("Telegram api_hash is missing.", {
      kind: "setup",
      advice: "Run `npm run login:qr` or `npm run login` in C:\\Users\\User\\plugins\\telegram-agent, or set TELEGRAM_API_HASH."
    });
  }
  if (!session) {
    throw new TelegramAgentError("Telegram session is missing.", {
      kind: "setup",
      advice: "Run `npm run login:qr` in C:\\Users\\User\\plugins\\telegram-agent, or use `npm run login` after Telegram rate limits expire."
    });
  }
  return { apiId, apiHash, session };
}

function basicSessionFormat(session) {
  if (!session) return "missing";
  if (session.startsWith("1")) return "gramjs_string";
  if (/^[A-Za-z0-9_+/=-]+$/.test(session)) return "not_gramjs_string_or_unknown";
  return "unknown";
}

function createStringSession(StringSession, session) {
  try {
    return { stringSession: new StringSession(session), sessionFormat: basicSessionFormat(session) };
  } catch (error) {
    throw new TelegramAgentError("Telegram session file is not a valid GramJS string session.", {
      kind: "session_format",
      session_format: basicSessionFormat(session),
      advice: "Run `npm run login:qr` to create a fresh GramJS session, or use `npm run login` after Telegram rate limits expire."
    });
  }
}

async function getClient() {
  const { TelegramClient, StringSession } = loadTelegramLib();
  const config = loadRuntimeConfig();
  const sessionKey = crypto.createHash("sha256").update(config.session).digest("hex");

  if (cachedClient && cachedSessionKey === sessionKey) {
    return cachedClient;
  }

  if (cachedClient) {
    try {
      await cachedClient.disconnect();
    } catch {
      // Ignore disconnect failures while replacing the client.
    }
  }

  const { stringSession } = createStringSession(StringSession, config.session);
  const client = new TelegramClient(stringSession, config.apiId, config.apiHash, {
    connectionRetries: 5
  });
  await client.connect();
  try {
    await client.getMe();
  } catch (error) {
    throw new TelegramAgentError("Telegram session is not authorized.", {
      kind: "auth",
      advice: "Run `npm run login` again and complete Telegram verification.",
      telegram_error: error.message
    });
  }
  cachedClient = client;
  cachedSessionKey = sessionKey;
  return client;
}

async function disconnectCachedClient() {
  if (!cachedClient) return;
  try {
    await cachedClient.disconnect();
  } catch {
    // Ignore disconnect failures during one-shot CLI shutdown.
  } finally {
    cachedClient = null;
    cachedSessionKey = "";
  }
}

function clampInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(number)));
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeMatch(value) {
  return normalizeText(value).toLowerCase();
}

function truncate(value, maxLength) {
  const text = normalizeText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function toIdString(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "object" && "value" in value) return String(value.value);
  return String(value);
}

function entityTitle(entity) {
  if (!entity) return "";
  if (entity.title) return String(entity.title);
  const person = [entity.firstName, entity.lastName].filter(Boolean).join(" ").trim();
  if (person) return person;
  if (entity.username) return `@${entity.username}`;
  return toIdString(entity.id) || "Unknown chat";
}

function entityKind(entity) {
  const raw = entity && (entity.className || (entity.constructor && entity.constructor.name));
  if (!raw) return "unknown";
  return String(raw).replace(/^Api\./, "");
}

function entitySummary(entity) {
  const username = entity && entity.username ? String(entity.username) : null;
  const id = entity ? toIdString(entity.id) : null;
  const type = entityKind(entity);
  return {
    ref: username ? `@${username}` : `${type}:${id}`,
    id,
    type,
    title: entityTitle(entity),
    username,
    is_bot: Boolean(entity && entity.bot),
    is_self: Boolean(entity && entity.self),
    verified: Boolean(entity && entity.verified),
    restricted: Boolean(entity && entity.restricted),
    scam: Boolean(entity && entity.scam),
    fake: Boolean(entity && entity.fake)
  };
}

function dialogSummary(dialog) {
  const entity = entitySummary(dialog.entity);
  const lastMessage = dialog.message || dialog.topMessage || null;
  return {
    ...entity,
    unread_count: Number(dialog.unreadCount || 0),
    unread_mentions_count: Number(dialog.unreadMentionsCount || 0),
    pinned: Boolean(dialog.pinned),
    last_message: lastMessage && lastMessage.message ? truncate(lastMessage.message, 180) : null,
    last_message_id: lastMessage && lastMessage.id ? Number(lastMessage.id) : null
  };
}

function dialogMatchesQuery(summary, query) {
  const wanted = normalizeMatch(query).replace(/^@/, "");
  if (!wanted) return true;
  const candidates = [
    summary.id,
    summary.ref,
    summary.title,
    summary.username,
    summary.username ? `@${summary.username}` : ""
  ].filter(Boolean);
  return candidates.some((candidate) => normalizeMatch(candidate).replace(/^@/, "").includes(wanted));
}

function messageDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return new Date(value * 1000).toISOString();
  return String(value);
}

function senderRef(message) {
  return toIdString(message.senderId || message.fromId || null);
}

function messageSummary(message, includeText) {
  return {
    id: Number(message.id),
    date: messageDate(message.date),
    outgoing: Boolean(message.out),
    sender_id: senderRef(message),
    reply_to_msg_id: message.replyTo && message.replyTo.replyToMsgId ? Number(message.replyTo.replyToMsgId) : null,
    text: includeText ? truncate(message.message || "", 2500) : undefined,
    has_media: Boolean(message.media),
    views: message.views == null ? null : Number(message.views)
  };
}

function chronologicalMessages(messages) {
  return [...messages].sort((a, b) => {
    const aTime = a.date instanceof Date ? a.date.getTime() : Number(a.date || 0) * 1000;
    const bTime = b.date instanceof Date ? b.date.getTime() : Number(b.date || 0) * 1000;
    return aTime - bTime;
  });
}

function latestMessages(messages) {
  return [...messages].sort((a, b) => {
    const aTime = a.date instanceof Date ? a.date.getTime() : Number(a.date || 0) * 1000;
    const bTime = b.date instanceof Date ? b.date.getTime() : Number(b.date || 0) * 1000;
    return bTime - aTime;
  });
}

function messagePlainText(message) {
  return normalizeText(message && message.message ? message.message : "");
}

function buildChatStats(messages) {
  const chronological = chronologicalMessages(messages);
  const textMessages = chronological.filter((message) => messagePlainText(message));
  const lastOutgoingIndex = chronological.findLastIndex((message) => message.out);
  const messagesAfterLastOutgoing = lastOutgoingIndex >= 0 ? chronological.slice(lastOutgoingIndex + 1) : chronological;
  const pendingIncoming = messagesAfterLastOutgoing.filter((message) => !message.out && (messagePlainText(message) || message.media));
  const questions = latestMessages(textMessages)
    .filter((message) => !message.out && /[?？]\s*$|[?？]\s/.test(messagePlainText(message)))
    .slice(0, 5)
    .map((message) => messageSummary(message, true));
  const urgentMatches = latestMessages(textMessages)
    .filter((message) => /сроч|urgent|asap|важн|важно|пожалуйста|please/i.test(messagePlainText(message)))
    .slice(0, 5)
    .map((message) => messageSummary(message, true));

  return {
    total_messages: chronological.length,
    text_messages: textMessages.length,
    incoming_messages: chronological.filter((message) => !message.out).length,
    outgoing_messages: chronological.filter((message) => message.out).length,
    media_messages: chronological.filter((message) => message.media).length,
    first_message_at: chronological[0] ? messageDate(chronological[0].date) : null,
    latest_message_at: chronological[chronological.length - 1] ? messageDate(chronological[chronological.length - 1].date) : null,
    latest_direction: chronological.length ? (chronological[chronological.length - 1].out ? "outgoing" : "incoming") : null,
    pending_incoming_after_last_outgoing: pendingIncoming.length,
    recent_questions: questions,
    recent_priority_terms: urgentMatches
  };
}

function contextHints(stats) {
  const hints = [];
  if (stats.pending_incoming_after_last_outgoing > 0) {
    hints.push(`${stats.pending_incoming_after_last_outgoing} incoming message(s) arrived after the latest outgoing message.`);
  }
  if (stats.recent_questions.length) {
    hints.push("Recent incoming questions were detected; answer them explicitly in a draft.");
  }
  if (stats.recent_priority_terms.length) {
    hints.push("Priority wording was detected; check urgency before drafting.");
  }
  if (!hints.length) {
    hints.push("No obvious pending incoming question was detected in the fetched window.");
  }
  hints.push("Use telegram_create_draft for one-off replies. Use telegram_send_message only when the user explicitly authorized direct sending to this same resolved chat.");
  return hints;
}

async function resolveEntity(client, chat) {
  const raw = String(chat || "").trim();
  if (!raw) {
    throw new TelegramAgentError("chat is required", { kind: "input" });
  }

  const lower = raw.toLowerCase();
  if (["me", "self", "saved", "saved messages"].includes(lower)) {
    return client.getEntity("me");
  }

  const tmeMatch = raw.match(/^https?:\/\/t\.me\/([^/?#]+)/i);
  const directRef = tmeMatch ? `@${tmeMatch[1]}` : raw;
  try {
    return await client.getEntity(directRef);
  } catch {
    // Fall back to matching visible dialogs below.
  }

  const wanted = normalizeMatch(raw.replace(/^@/, ""));
  const dialogs = await client.getDialogs({ limit: 200 });
  const matches = [];
  for (const dialog of dialogs) {
    const summary = entitySummary(dialog.entity);
    const candidates = [
      summary.id,
      summary.ref,
      summary.title,
      summary.username,
      summary.username ? `@${summary.username}` : ""
    ].filter(Boolean);
    if (candidates.some((candidate) => normalizeMatch(candidate).replace(/^@/, "") === wanted)) {
      matches.push({ entity: dialog.entity, summary });
    }
  }

  if (matches.length === 1) return matches[0].entity;
  if (matches.length > 1) {
    throw new TelegramAgentError("More than one Telegram dialog matched this chat reference.", {
      kind: "ambiguous_chat",
      candidates: matches.slice(0, 10).map((match) => match.summary)
    });
  }

  throw new TelegramAgentError("Telegram chat was not found in recent dialogs.", {
    kind: "chat_not_found",
    advice: "Use telegram_list_dialogs first, then pass a returned ref, username, exact title, or id."
  });
}

async function telegramSetupStatus(args = {}) {
  const config = readJson(CONFIG_FILE);
  const hasConfigApiId = Boolean(process.env.TELEGRAM_API_ID || config.api_id);
  const hasConfigApiHash = Boolean(process.env.TELEGRAM_API_HASH || config.api_hash);
  const rawSession = String(process.env.TELEGRAM_STRING_SESSION || readText(SESSION_FILE)).trim();
  const hasSession = Boolean(rawSession);
  let dependenciesInstalled = true;
  let dependencyError = null;
  try {
    loadTelegramLib();
  } catch (error) {
    dependenciesInstalled = false;
    dependencyError = error.message;
  }

  const result = {
    data_dir: DATA_DIR,
    config_file: CONFIG_FILE,
    session_file: SESSION_FILE,
    dependencies_installed: dependenciesInstalled,
    dependency_error: dependencyError,
    api_id_configured: hasConfigApiId,
    api_hash_configured: hasConfigApiHash,
    session_configured: hasSession,
    session_format: basicSessionFormat(rawSession),
    send_enabled: process.env.TELEGRAM_AGENT_ALLOW_SEND === "1",
    tdata_supported: false,
    setup_advice: "Run `npm install` and then `npm run login:qr` or `npm run login` in C:\\Users\\User\\plugins\\telegram-agent."
  };

  if (args.check_connection) {
    try {
      const client = await getClient();
      const me = await client.getMe();
      result.connection = {
        ok: true,
        account: entitySummary(me)
      };
    } catch (error) {
      result.connection = {
        ok: false,
        error: error.message,
        details: safeDetails(error.details || {})
      };
    }
  }

  return result;
}

async function telegramMe() {
  const client = await getClient();
  const me = await client.getMe();
  return {
    account: entitySummary(me),
    send_enabled: process.env.TELEGRAM_AGENT_ALLOW_SEND === "1"
  };
}

async function telegramListDialogs(args = {}) {
  const client = await getClient();
  const limit = clampInteger(args.limit, 20, 1, MAX_DIALOG_LIMIT);
  const unreadOnly = Boolean(args.unread_only);
  const query = normalizeMatch(args.query || "");
  const dialogs = await client.getDialogs({ limit });
  let items = dialogs.map(dialogSummary);
  if (unreadOnly) {
    items = items.filter((item) => item.unread_count > 0 || item.unread_mentions_count > 0);
  }
  if (query) {
    items = items.filter((item) => {
      return [item.title, item.username, item.ref, item.id].filter(Boolean).some((value) => normalizeMatch(value).includes(query));
    });
  }
  return {
    count: items.length,
    dialogs: items,
    warnings: ["Use the returned ref or username as the chat argument for message tools."]
  };
}

async function telegramFindDialogs(args = {}) {
  const query = normalizeText(args.query);
  if (!query) {
    throw new TelegramAgentError("query is required", { kind: "input" });
  }
  const client = await getClient();
  const scanLimit = clampInteger(args.scan_limit, 100, 1, 200);
  const maxResults = clampInteger(args.max_results, 15, 1, 50);
  const dialogs = await client.getDialogs({ limit: scanLimit });
  const matches = dialogs
    .map(dialogSummary)
    .filter((summary) => dialogMatchesQuery(summary, query))
    .slice(0, maxResults);
  return {
    query,
    scanned: dialogs.length,
    count: matches.length,
    dialogs: matches,
    warnings: matches.length ? ["Pass a returned ref, username, exact title, or id as chat."] : ["No matching dialogs found in the scanned window."]
  };
}

async function telegramInboxBrief(args = {}) {
  const client = await getClient();
  const limit = clampInteger(args.limit, 10, 1, 30);
  const messagesPerChat = clampInteger(args.messages_per_chat, 3, 1, 10);
  const unreadOnly = args.unread_only !== false;
  const includeMessages = args.include_messages !== false;
  const incomingOnly = args.incoming_only !== false;
  const dialogs = await client.getDialogs({ limit: Math.max(limit * 3, limit) });
  const selected = dialogs
    .map((dialog) => ({ dialog, summary: dialogSummary(dialog) }))
    .filter((item) => !unreadOnly || item.summary.unread_count > 0 || item.summary.unread_mentions_count > 0)
    .slice(0, limit);

  const items = [];
  for (const item of selected) {
    const entry = { ...item.summary };
    if (includeMessages) {
      const requested = unreadOnly && item.summary.unread_count > 0 ? Math.min(item.summary.unread_count, messagesPerChat) : messagesPerChat;
      const messages = await client.getMessages(item.dialog.entity, { limit: requested });
      const filtered = messages
        .filter((message) => !incomingOnly || !message.out)
        .filter((message) => message.message || message.media)
        .slice(0, messagesPerChat);
      entry.messages = filtered.map((message) => messageSummary(message, true));
      entry.message_count = entry.messages.length;
    }
    items.push(entry);
  }

  return {
    mode: unreadOnly ? "unread" : "recent",
    count: items.length,
    totals: {
      unread_dialogs: dialogs.filter((dialog) => Number(dialog.unreadCount || 0) > 0).length,
      unread_messages_in_returned_dialogs: items.reduce((sum, item) => sum + Number(item.unread_count || 0), 0)
    },
    dialogs: items,
    agent_hints: [
      "Use telegram_chat_context for any dialog that needs a careful reply.",
      "Use telegram_create_draft after composing a reply in Codex."
    ]
  };
}

async function telegramRecentMessages(args = {}) {
  const client = await getClient();
  const entity = await resolveEntity(client, args.chat);
  const limit = clampInteger(args.limit, 30, 1, MAX_MESSAGE_LIMIT);
  const includeOutgoing = args.include_outgoing !== false;
  const includeEmpty = Boolean(args.include_empty);
  const messages = await client.getMessages(entity, { limit });
  const filtered = messages
    .filter((message) => includeOutgoing || !message.out)
    .filter((message) => includeEmpty || message.message || message.media)
    .map((message) => messageSummary(message, true));

  return {
    chat: entitySummary(entity),
    count: filtered.length,
    messages: filtered
  };
}

async function telegramChatContext(args = {}) {
  const client = await getClient();
  const entity = await resolveEntity(client, args.chat);
  const limit = clampInteger(args.limit, 40, 1, MAX_MESSAGE_LIMIT);
  const includeOutgoing = args.include_outgoing !== false;
  const includeEmpty = Boolean(args.include_empty);
  const order = args.order === "latest_first" ? "latest_first" : "chronological";
  const messages = await client.getMessages(entity, { limit });
  const filtered = messages
    .filter((message) => includeOutgoing || !message.out)
    .filter((message) => includeEmpty || message.message || message.media);
  const ordered = order === "chronological" ? chronologicalMessages(filtered) : latestMessages(filtered);
  const stats = buildChatStats(filtered);

  return {
    chat: entitySummary(entity),
    count: ordered.length,
    order,
    stats,
    agent_hints: contextHints(stats),
    messages: ordered.map((message) => messageSummary(message, true))
  };
}

async function telegramSearchChatMessages(args = {}) {
  const query = normalizeText(args.query);
  if (!query) {
    throw new TelegramAgentError("query is required", { kind: "input" });
  }
  const client = await getClient();
  const entity = await resolveEntity(client, args.chat);
  const limit = clampInteger(args.limit, 30, 1, MAX_MESSAGE_LIMIT);
  const messages = await client.getMessages(entity, { limit, search: query });
  return {
    chat: entitySummary(entity),
    query,
    count: messages.length,
    messages: messages.map((message) => messageSummary(message, true))
  };
}

function validateDraftText(text) {
  const normalized = String(text || "").trim();
  if (!normalized) {
    throw new TelegramAgentError("Draft text is required.", { kind: "input" });
  }
  if (normalized.length > MAX_DRAFT_TEXT_LENGTH) {
    throw new TelegramAgentError(`Draft text is too long. Maximum is ${MAX_DRAFT_TEXT_LENGTH} characters.`, {
      kind: "input"
    });
  }
  return normalized;
}

function validateAuthorizationBasis(value) {
  const normalized = normalizeText(value);
  if (normalized.length < 12) {
    throw new TelegramAgentError("authorization_basis must describe the user's current send authorization.", {
      kind: "input"
    });
  }
  return truncate(normalized, 500);
}

function draftPath(draftId) {
  if (!/^[a-f0-9-]{36}$/i.test(String(draftId || ""))) {
    throw new TelegramAgentError("Invalid draft id.", { kind: "input" });
  }
  return path.join(DRAFT_DIR, `${draftId}.json`);
}

function readDraft(draftId) {
  const filePath = draftPath(draftId);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    throw new TelegramAgentError("Draft was not found.", { kind: "not_found" });
  }
}

function publicDraft(draft) {
  return {
    draft_id: draft.draft_id,
    created_at: draft.created_at,
    chat: draft.chat,
    text: draft.text,
    note: draft.note || null,
    confirmation_phrase: draft.confirmation_phrase
  };
}

async function telegramCreateDraft(args = {}) {
  const text = validateDraftText(args.text);
  const client = await getClient();
  const entity = await resolveEntity(client, args.chat);
  const chat = entitySummary(entity);
  const draftId = crypto.randomUUID();
  const draft = {
    draft_id: draftId,
    created_at: new Date().toISOString(),
    chat_input: String(args.chat || "").trim(),
    chat,
    text,
    note: truncate(args.note || "", 500) || null,
    confirmation_phrase: `SEND ${draftId}`
  };
  writeJson(draftPath(draftId), draft);
  appendAuditEvent("draft_created", {
    draft_id: draftId,
    chat: auditChat(chat),
    ...textFingerprint(text),
    note_present: Boolean(draft.note)
  });
  return {
    ...publicDraft(draft),
    send_warning: "This is only a local draft. Show the recipient and exact text to the user before any send."
  };
}

async function telegramListDrafts(args = {}) {
  fs.mkdirSync(DRAFT_DIR, { recursive: true });
  const limit = clampInteger(args.limit, 20, 1, 100);
  const drafts = fs
    .readdirSync(DRAFT_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(DRAFT_DIR, name), "utf8"));
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, limit)
    .map(publicDraft);
  return { count: drafts.length, drafts };
}

async function telegramRecentAuditEvents(args = {}) {
  const limit = clampInteger(args.limit, 20, 1, 100);
  let lines = [];
  try {
    lines = fs.readFileSync(AUDIT_FILE, "utf8").split(/\r?\n/).filter(Boolean);
  } catch {
    lines = [];
  }
  const events = lines
    .slice(-limit)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .reverse();
  return {
    audit_file: AUDIT_FILE,
    count: events.length,
    events,
    warning: "Audit events include chat metadata and text fingerprints, but not full message text."
  };
}

async function telegramDeleteDraft(args = {}) {
  const draft = readDraft(args.draft_id);
  fs.unlinkSync(draftPath(args.draft_id));
  appendAuditEvent("draft_deleted", {
    draft_id: draft.draft_id,
    chat: auditChat(draft.chat),
    ...textFingerprint(draft.text)
  });
  return {
    deleted: true,
    draft: publicDraft(draft)
  };
}

async function telegramSendDraft(args = {}) {
  if (process.env.TELEGRAM_AGENT_ALLOW_SEND !== "1") {
    throw new TelegramAgentError("Sending is disabled.", {
      kind: "send_disabled",
      advice: "Set TELEGRAM_AGENT_ALLOW_SEND=1 before starting Codex, then create and confirm a draft."
    });
  }
  const draft = readDraft(args.draft_id);
  if (String(args.confirmation || "") !== draft.confirmation_phrase) {
    throw new TelegramAgentError("Confirmation phrase does not match this draft.", {
      kind: "confirmation_required",
      expected_phrase: draft.confirmation_phrase
    });
  }
  const client = await getClient();
  const entity = await resolveEntity(client, draft.chat_input || (draft.chat && (draft.chat.username || draft.chat.ref)));
  const sent = await client.sendMessage(entity, { message: draft.text });
  fs.unlinkSync(draftPath(args.draft_id));
  appendAuditEvent("draft_sent", {
    draft_id: draft.draft_id,
    chat: auditChat(entitySummary(entity)),
    message_id: sent && sent.id ? Number(sent.id) : null,
    ...textFingerprint(draft.text)
  });
  return {
    sent: true,
    chat: entitySummary(entity),
    message_id: sent && sent.id ? Number(sent.id) : null,
    draft_id: draft.draft_id
  };
}

async function telegramSendMessage(args = {}) {
  if (process.env.TELEGRAM_AGENT_ALLOW_SEND !== "1") {
    throw new TelegramAgentError("Sending is disabled.", {
      kind: "send_disabled",
      advice: "Set TELEGRAM_AGENT_ALLOW_SEND=1 before starting Codex, then only send when the user explicitly authorized this chat."
    });
  }
  const text = validateDraftText(args.text);
  const authorizationBasis = validateAuthorizationBasis(args.authorization_basis);
  const client = await getClient();
  const entity = await resolveEntity(client, args.chat);
  const chat = entitySummary(entity);
  const replySession = intelligence.assertReplySessionForSend(chat, text, authorizationBasis);
  const sent = await client.sendMessage(entity, { message: text });
  const updatedSession = intelligence.recordReplySessionSend(replySession.session_id);
  appendAuditEvent("message_sent", {
    chat: auditChat(chat),
    message_id: sent && sent.id ? Number(sent.id) : null,
    reply_session_id: replySession.session_id,
    authorization_basis: authorizationBasis,
    ...textFingerprint(text)
  });
  return {
    sent: true,
    chat,
    message_id: sent && sent.id ? Number(sent.id) : null,
    text,
    authorization_basis: authorizationBasis,
    reply_session: updatedSession
  };
}

async function callTool(name, args) {
  const intelligenceContext = {
    getClient,
    resolveEntity,
    entitySummary,
    dialogSummary,
    messageSummary
  };
  switch (name) {
    case "telegram_setup_status":
      return telegramSetupStatus(args || {});
    case "telegram_me":
      return telegramMe(args || {});
    case "telegram_list_dialogs":
      return telegramListDialogs(args || {});
    case "telegram_find_dialogs":
      return telegramFindDialogs(args || {});
    case "telegram_inbox_brief":
      return telegramInboxBrief(args || {});
    case "telegram_recent_messages":
      return telegramRecentMessages(args || {});
    case "telegram_chat_context":
      return telegramChatContext(args || {});
    case "telegram_search_chat_messages":
      return telegramSearchChatMessages(args || {});
    case "telegram_create_draft":
      return telegramCreateDraft(args || {});
    case "telegram_list_drafts":
      return telegramListDrafts(args || {});
    case "telegram_recent_audit_events":
      return telegramRecentAuditEvents(args || {});
    case "telegram_delete_draft":
      return telegramDeleteDraft(args || {});
    case "telegram_send_draft":
      return telegramSendDraft(args || {});
    case "telegram_send_message":
      return telegramSendMessage(args || {});
    default:
      if (name === "telegram_start_reply_session") {
        const client = await getClient();
        const entity = await resolveEntity(client, args && args.chat);
        return intelligence.createReplySession(args || {}, entitySummary(entity));
      }
      if (name === "telegram_contact_context") {
        const client = await getClient();
        const entity = await resolveEntity(client, args && args.chat);
        return intelligence.contactMemory(args || {}, entitySummary(entity));
      }
      if (intelligence.hasTool(name)) {
        return intelligence.handleTool(name, args || {}, intelligenceContext);
      }
      throw new TelegramAgentError(`Unknown tool: ${name}`, { kind: "input" });
  }
}

function safeDetails(details) {
  const clone = { ...details };
  for (const key of Object.keys(clone)) {
    if (/hash|session|password|code|token|secret/i.test(key)) {
      clone[key] = "[redacted]";
    }
  }
  return clone;
}

function frameMessage(payload) {
  const body = JSON.stringify(payload);
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

function send(payload) {
  process.stdout.write(frameMessage(payload));
}

function success(id, result) {
  if (id === undefined || id === null) return;
  send({ jsonrpc: "2.0", id, result });
}

function failure(id, code, message, data) {
  if (id === undefined || id === null) return;
  send({ jsonrpc: "2.0", id, error: { code, message, data } });
}

async function handleRpc(message) {
  const id = message.id;
  try {
    if (message.method === "initialize") {
      success(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "telegram-agent", version: "0.1.0" }
      });
      return;
    }
    if (message.method === "notifications/initialized") return;
    if (message.method === "tools/list") {
      success(id, { tools: TOOLS });
      return;
    }
    if (message.method === "tools/call") {
      const { name, arguments: args } = message.params || {};
      try {
        const result = await callTool(name, args || {});
        success(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: false
        });
      } catch (error) {
        success(id, {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: error.message,
                  details: safeDetails(error.details || {})
                },
                null,
                2
              )
            }
          ],
          isError: true
        });
      }
      return;
    }
    failure(id, -32601, `Method not found: ${message.method}`);
  } catch (error) {
    failure(id, -32603, error.message);
  }
}

function findHeader(buffer) {
  const crlf = buffer.indexOf(Buffer.from("\r\n\r\n"));
  if (crlf !== -1) return { index: crlf, bodyStart: crlf + 4 };
  const lf = buffer.indexOf(Buffer.from("\n\n"));
  if (lf !== -1) return { index: lf, bodyStart: lf + 2 };
  return null;
}

function startMcpServer() {
  let buffer = Buffer.alloc(0);
  process.stdin.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
    while (buffer.length) {
      const header = findHeader(buffer);
      if (!header) {
        const newline = buffer.indexOf(10);
        if (newline === -1) break;
        const line = buffer.slice(0, newline).toString("utf8").trim();
        buffer = buffer.slice(newline + 1);
        if (line) {
          try {
            handleRpc(JSON.parse(line));
          } catch (error) {
            failure(null, -32700, error.message);
          }
        }
        continue;
      }

      const headerText = buffer.slice(0, header.index).toString("utf8");
      const lengthMatch = headerText.match(/content-length:\s*(\d+)/i);
      if (!lengthMatch) {
        buffer = buffer.slice(header.bodyStart);
        continue;
      }
      const length = Number(lengthMatch[1]);
      const total = header.bodyStart + length;
      if (buffer.length < total) break;
      const body = buffer.slice(header.bodyStart, total).toString("utf8");
      buffer = buffer.slice(total);
      try {
        handleRpc(JSON.parse(body));
      } catch (error) {
        failure(null, -32700, error.message);
      }
    }
  });
  process.stdin.resume();
}

async function selfTest() {
  let dependenciesInstalled = true;
  let dependencyError = null;
  try {
    loadTelegramLib();
  } catch (error) {
    dependenciesInstalled = false;
    dependencyError = error.message;
  }
  return {
    server: "telegram-agent",
    tools: TOOLS.map((tool) => tool.name),
    dependencies_installed: dependenciesInstalled,
    dependency_error: dependencyError,
    data_dir: DATA_DIR,
    session_configured: Boolean(process.env.TELEGRAM_STRING_SESSION || readText(SESSION_FILE)),
    session_format: basicSessionFormat(String(process.env.TELEGRAM_STRING_SESSION || readText(SESSION_FILE)).trim()),
    send_enabled: process.env.TELEGRAM_AGENT_ALLOW_SEND === "1",
    tdata_supported: false
  };
}

if (require.main === module) {
  if (process.argv[2] === "--self-test") {
    selfTest()
      .then((result) => console.log(JSON.stringify(result, null, 2)))
      .catch((error) => {
        console.error(JSON.stringify({ error: error.message, details: safeDetails(error.details || {}) }, null, 2));
        process.exitCode = 1;
      });
  } else if (process.argv[2] === "--call") {
    const name = process.argv[3];
    const args = process.argv[4] ? JSON.parse(process.argv[4]) : {};
    callTool(name, args)
      .then(async (result) => {
        console.log(JSON.stringify(result, null, 2));
        await disconnectCachedClient();
      })
      .catch(async (error) => {
        console.error(JSON.stringify({ error: error.message, details: safeDetails(error.details || {}) }, null, 2));
        await disconnectCachedClient();
        process.exitCode = 1;
      });
  } else {
    startMcpServer();
  }
}

module.exports = {
  callTool,
  entitySummary,
  messageSummary,
  buildChatStats,
  telegramSetupStatus,
  basicSessionFormat,
  validateAuthorizationBasis,
  textFingerprint
};
