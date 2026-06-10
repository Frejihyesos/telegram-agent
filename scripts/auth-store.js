"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const intelligence = require("./intelligence-store");

const DATA_DIR = process.env.TELEGRAM_AGENT_DATA_DIR || path.join(os.homedir(), ".codex", "telegram-agent");
const CONFIG_FILE = process.env.TELEGRAM_CONFIG_FILE || path.join(DATA_DIR, "config.json");
const SESSION_FILE = process.env.TELEGRAM_SESSION_FILE || path.join(DATA_DIR, "session.txt");
const SQLITE_FILE = process.env.TELEGRAM_AGENT_DB_FILE || path.join(DATA_DIR, "telegram-agent.sqlite");

function nowIso() {
  return new Date().toISOString();
}

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

function hashValue(value) {
  if (!value) return null;
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function basicSessionFormat(session) {
  if (!session) return "missing";
  if (session.startsWith("1")) return "gramjs_string";
  if (/^[A-Za-z0-9_+/=-]+$/.test(session)) return "not_gramjs_string_or_unknown";
  return "unknown";
}

function ensureTables() {
  const db = intelligence.getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      state TEXT NOT NULL,
      account_json TEXT NOT NULL DEFAULT '{}',
      api_id_sha256 TEXT,
      session_sha256 TEXT,
      session_format TEXT,
      last_error TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_events (
      event_id TEXT PRIMARY KEY,
      at TEXT NOT NULL,
      type TEXT NOT NULL,
      details_json TEXT NOT NULL DEFAULT '{}'
    );
  `);
  return db;
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function redactDetails(details = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(details || {})) {
    if (/hash|session|password|code|token|secret/i.test(key)) {
      clean[key] = "[redacted]";
    } else if (typeof value === "string" && value.length > 500) {
      clean[key] = `${value.slice(0, 500)}...`;
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

function recordAuthEvent(type, details = {}) {
  const db = ensureTables();
  db.prepare("INSERT INTO auth_events (event_id, at, type, details_json) VALUES (?, ?, ?, ?)").run(
    crypto.randomUUID(),
    nowIso(),
    String(type || "auth_event"),
    JSON.stringify(redactDetails(details))
  );
}

function readAuthStateRow() {
  const db = ensureTables();
  return db.prepare("SELECT * FROM auth_state WHERE id = 1").get() || null;
}

function recordAuthState(fields = {}) {
  const db = ensureTables();
  const current = readAuthStateRow();
  const config = readConfig();
  const session = readSession();
  const state = fields.state || (session ? "logged_in" : config.api_id && config.api_hash ? "config_ready" : "not_configured");
  const account = fields.account || (current ? parseJson(current.account_json, {}) : {});
  const timestamp = nowIso();
  db.prepare(`
    INSERT INTO auth_state (id, state, account_json, api_id_sha256, session_sha256, session_format, last_error, updated_at)
    VALUES (1, @state, @account_json, @api_id_sha256, @session_sha256, @session_format, @last_error, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      state = excluded.state,
      account_json = excluded.account_json,
      api_id_sha256 = excluded.api_id_sha256,
      session_sha256 = excluded.session_sha256,
      session_format = excluded.session_format,
      last_error = excluded.last_error,
      updated_at = excluded.updated_at
  `).run({
    state,
    account_json: JSON.stringify(account || {}),
    api_id_sha256: config.api_id ? hashValue(String(config.api_id)) : null,
    session_sha256: session ? hashValue(session) : null,
    session_format: basicSessionFormat(session),
    last_error: fields.last_error || null,
    updated_at: timestamp
  });
  return readAuthStateRow();
}

function readConfig() {
  return readJson(CONFIG_FILE);
}

function readSession() {
  return String(process.env.TELEGRAM_STRING_SESSION || readText(SESSION_FILE)).trim();
}

function validateApiConfig(input = {}) {
  const apiId = Number(input.api_id);
  const apiHash = String(input.api_hash || "").trim();
  if (!Number.isInteger(apiId) || apiId <= 0) {
    throw new Error("api_id must be a positive integer.");
  }
  if (!/^[a-f0-9]{32}$/i.test(apiHash)) {
    throw new Error("api_hash must be the 32-character hash from my.telegram.org/apps.");
  }
  return { api_id: apiId, api_hash: apiHash };
}

function writeConfig(input = {}) {
  const config = validateApiConfig(input);
  writeJson(CONFIG_FILE, config);
  recordAuthState({ state: readSession() ? "logged_in" : "config_ready" });
  recordAuthEvent("config_saved", { api_id_configured: true, api_hash_configured: true });
  return config;
}

function accountSummary(user) {
  if (!user) return null;
  const userId = user.id === undefined || user.id === null ? null : String(user.id.value || user.id);
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || (user.username ? `@${user.username}` : userId);
  return {
    user_id: userId,
    display_name: displayName,
    username: user.username || null,
    is_bot: Boolean(user.bot)
  };
}

function writeSession(session, user) {
  const normalized = String(session || "").trim();
  if (!normalized) throw new Error("Cannot save an empty Telegram session.");
  fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
  fs.writeFileSync(SESSION_FILE, `${normalized}\n`, "utf8");
  const account = accountSummary(user);
  recordAuthState({ state: "logged_in", account });
  recordAuthEvent("session_saved", {
    account_username: account && account.username,
    account_user_id: account && account.user_id,
    session_format: basicSessionFormat(normalized)
  });
  return account;
}

function removeSession() {
  try {
    fs.unlinkSync(SESSION_FILE);
  } catch {
    // Missing session is already removed.
  }
  recordAuthState({ state: readConfig().api_id && readConfig().api_hash ? "config_ready" : "not_configured" });
  recordAuthEvent("session_removed");
}

function authStatus(overrides = {}) {
  const config = readConfig();
  const session = readSession();
  const sessionHash = session ? hashValue(session) : null;
  const row = readAuthStateRow();
  const account = overrides.account || (row ? parseJson(row.account_json, {}) : null);
  let state = overrides.state;
  if (!state) {
    if (session) state = "logged_in";
    else if (config.api_id && config.api_hash) state = "config_ready";
    else state = "not_configured";
  }
  return {
    state,
    data_dir: DATA_DIR,
    paths: {
      config_path: CONFIG_FILE,
      session_path: SESSION_FILE,
      sqlite_path: SQLITE_FILE
    },
    api_id_configured: Boolean(process.env.TELEGRAM_API_ID || config.api_id),
    api_hash_configured: Boolean(process.env.TELEGRAM_API_HASH || config.api_hash),
    api_id: config.api_id || null,
    api_hash_masked: config.api_hash ? "********" : null,
    session_configured: Boolean(session),
    session_format: basicSessionFormat(session),
    session_fingerprint: sessionHash ? sessionHash.slice(0, 12) : null,
    account: account && Object.keys(account).length ? account : null,
    latest_error: overrides.last_error || (row && row.last_error) || null,
    updated_at: (row && row.updated_at) || null
  };
}

function sanitizePhone(phoneNumber) {
  const trimmed = String(phoneNumber || "").trim();
  if (!trimmed) return "";
  const sign = trimmed.startsWith("+") ? "+" : "";
  return `${sign}${trimmed.replace(/[^\d]/g, "")}`;
}

function loadRuntimeConfig({ requireSession = true } = {}) {
  const config = readConfig();
  const apiId = Number(process.env.TELEGRAM_API_ID || config.api_id || 0);
  const apiHash = String(process.env.TELEGRAM_API_HASH || config.api_hash || "").trim();
  const session = readSession();
  if (!Number.isInteger(apiId) || apiId <= 0) throw new Error("Telegram api_id is missing.");
  if (!apiHash) throw new Error("Telegram api_hash is missing.");
  if (requireSession && !session) throw new Error("Telegram session is missing.");
  return { apiId, apiHash, session };
}

module.exports = {
  DATA_DIR,
  CONFIG_FILE,
  SESSION_FILE,
  SQLITE_FILE,
  authStatus,
  accountSummary,
  basicSessionFormat,
  loadRuntimeConfig,
  readConfig,
  readSession,
  recordAuthEvent,
  recordAuthState,
  removeSession,
  sanitizePhone,
  validateApiConfig,
  writeConfig,
  writeSession
};
