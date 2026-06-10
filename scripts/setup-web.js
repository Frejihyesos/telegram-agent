#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const http = require("http");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const QRCode = require("qrcode");
const authStore = require("./auth-store");
const { renderSetupPage } = require("./setup-web-ui");

const DEFAULT_HOST = "127.0.0.1";
const MAX_BODY_BYTES = 16 * 1024;

let activeInstance = null;

class SetupError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "SetupError";
    this.statusCode = statusCode;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function loadTelegramLib() {
  const { TelegramClient } = require("telegram");
  const { StringSession } = require("telegram/sessions");
  return { TelegramClient, StringSession };
}

function createRuntime() {
  return {
    state: null,
    active_flow: null,
    client: null,
    flow_promise: null,
    cancelled: false,
    qr_svg: null,
    login_url: null,
    expires_at: null,
    account: null,
    latest_error: null,
    waiters: {},
    events: []
  };
}

function addEvent(runtime, type, message, level = "info") {
  runtime.events.push({
    at: nowIso(),
    type,
    message,
    level
  });
  runtime.events = runtime.events.slice(-50);
  authStore.recordAuthEvent(type, { message, level });
}

function safeError(error) {
  return String(error && (error.errorMessage || error.message || error)).replace(/(password|session|token|api_hash|code)[^,\s]*/gi, "$1=[redacted]");
}

function publicStatus(runtime) {
  const overrides = {
    state: runtime.state || undefined,
    account: runtime.account || undefined,
    last_error: runtime.latest_error || undefined
  };
  const status = authStore.authStatus(overrides);
  return {
    ...status,
    active_flow: runtime.active_flow,
    qr_svg: runtime.state === "waiting_qr" ? runtime.qr_svg : null,
    login_url: runtime.state === "waiting_qr" ? runtime.login_url : null,
    expires_at: runtime.state === "waiting_qr" ? runtime.expires_at : null,
    events: runtime.events
  };
}

function createDeferred(runtime, name) {
  if (runtime.waiters[name]) {
    runtime.waiters[name].reject(new Error(`${name} was replaced by a newer setup request.`));
  }
  return new Promise((resolve, reject) => {
    runtime.waiters[name] = { resolve, reject };
  }).finally(() => {
    delete runtime.waiters[name];
  });
}

function resolveWaiter(runtime, name, value) {
  const waiter = runtime.waiters[name];
  if (!waiter) throw new SetupError(`Setup is not waiting for ${name}.`, 409);
  waiter.resolve(value);
}

function rejectWaiters(runtime, error) {
  for (const waiter of Object.values(runtime.waiters)) {
    waiter.reject(error);
  }
  runtime.waiters = {};
}

function createClient({ requireSession = false } = {}) {
  const { TelegramClient, StringSession } = loadTelegramLib();
  const config = authStore.loadRuntimeConfig({ requireSession });
  const client = new TelegramClient(new StringSession(config.session || ""), config.apiId, config.apiHash, {
    connectionRetries: 5
  });
  return { client, config };
}

async function disconnectRuntime(runtime) {
  if (!runtime.client) return;
  try {
    await runtime.client.disconnect();
  } catch {
    // Ignore disconnect failures during setup cleanup.
  } finally {
    runtime.client = null;
  }
}

async function resetFlow(runtime, reason = "setup flow reset") {
  runtime.cancelled = true;
  rejectWaiters(runtime, new Error(reason));
  await disconnectRuntime(runtime);
  runtime.active_flow = null;
  runtime.flow_promise = null;
  runtime.qr_svg = null;
  runtime.login_url = null;
  runtime.expires_at = null;
  runtime.latest_error = null;
  runtime.cancelled = false;
  runtime.state = authStore.authStatus().state === "logged_in" ? "logged_in" : authStore.authStatus().state;
}

async function finalizeLogin(runtime, client, user) {
  const account = authStore.writeSession(client.session.save(), user);
  runtime.account = account;
  runtime.state = "logged_in";
  runtime.active_flow = null;
  runtime.qr_svg = null;
  runtime.login_url = null;
  runtime.expires_at = null;
  runtime.latest_error = null;
  addEvent(runtime, "login_completed", `Logged in as ${account && (account.username || account.display_name || account.user_id)}`, "success");
  await disconnectRuntime(runtime);
}

async function waitForState(runtime, predicate, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate(runtime)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function startQrFlow(runtime) {
  await resetFlow(runtime, "starting a new QR setup flow");
  runtime.state = "starting_qr";
  runtime.active_flow = "qr";
  runtime.cancelled = false;
  addEvent(runtime, "qr_started", "Starting QR login.", "info");

  runtime.flow_promise = (async () => {
    const { client, config } = createClient({ requireSession: false });
    runtime.client = client;
    await client.connect();
    const user = await client.signInUserWithQrCode(
      { apiId: config.apiId, apiHash: config.apiHash },
      {
        qrCode: async ({ token, expires }) => {
          if (runtime.cancelled) return;
          const loginUrl = `tg://login?token=${Buffer.from(token).toString("base64url")}`;
          runtime.login_url = loginUrl;
          runtime.expires_at = expires instanceof Date ? expires.toISOString() : new Date(Number(expires) * 1000).toISOString();
          runtime.qr_svg = await QRCode.toString(loginUrl, {
            type: "svg",
            errorCorrectionLevel: "M",
            margin: 1,
            width: 220
          });
          runtime.state = "waiting_qr";
          addEvent(runtime, "qr_generated", "QR code generated. Scan it in Telegram mobile.", "info");
        },
        password: async () => {
          runtime.state = "waiting_password";
          addEvent(runtime, "password_required", "Telegram account requires 2FA password.", "warning");
          return createDeferred(runtime, "password");
        },
        onError: async (error) => {
          runtime.state = "error";
          runtime.latest_error = safeError(error);
          addEvent(runtime, "qr_error", runtime.latest_error, "error");
          return false;
        }
      }
    );
    if (!runtime.cancelled) await finalizeLogin(runtime, client, user);
  })().catch(async (error) => {
    if (!runtime.cancelled) {
      runtime.state = "error";
      runtime.latest_error = safeError(error);
      addEvent(runtime, "qr_failed", runtime.latest_error, "error");
    }
    await disconnectRuntime(runtime);
  });

  await waitForState(runtime, (item) => ["waiting_qr", "waiting_password", "logged_in", "error"].includes(item.state));
  return publicStatus(runtime);
}

async function startPhoneFlow(runtime, phoneNumber) {
  await resetFlow(runtime, "starting a new phone setup flow");
  const phone = authStore.sanitizePhone(phoneNumber);
  if (!phone || !/^\+?\d{7,16}$/.test(phone)) throw new SetupError("Use a valid phone number in international format.");
  runtime.state = "starting_phone";
  runtime.active_flow = "phone";
  runtime.cancelled = false;
  addEvent(runtime, "phone_started", "Starting phone login.", "info");

  runtime.flow_promise = (async () => {
    const { client } = createClient({ requireSession: false });
    runtime.client = client;
    await client.start({
      phoneNumber: async () => phone,
      phoneCode: async () => {
        runtime.state = "waiting_code";
        addEvent(runtime, "code_required", "Telegram login code requested.", "info");
        return createDeferred(runtime, "code");
      },
      password: async () => {
        runtime.state = "waiting_password";
        addEvent(runtime, "password_required", "Telegram account requires 2FA password.", "warning");
        return createDeferred(runtime, "password");
      },
      onError: (error) => {
        runtime.state = "error";
        runtime.latest_error = safeError(error);
        addEvent(runtime, "phone_error", runtime.latest_error, "error");
      }
    });
    if (!runtime.cancelled) await finalizeLogin(runtime, client, await client.getMe());
  })().catch(async (error) => {
    if (!runtime.cancelled) {
      runtime.state = "error";
      runtime.latest_error = safeError(error);
      addEvent(runtime, "phone_failed", runtime.latest_error, "error");
    }
    await disconnectRuntime(runtime);
  });

  await waitForState(runtime, (item) => ["waiting_code", "waiting_password", "logged_in", "error"].includes(item.state));
  return publicStatus(runtime);
}

async function readJsonBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new SetupError("Request body is too large.", 413);
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new SetupError("Request body must be JSON.");
  }
}

function writeResponse(res, statusCode, headers, body) {
  res.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers
  });
  res.end(body);
}

function writeJson(res, statusCode, payload) {
  writeResponse(res, statusCode, { "Content-Type": "application/json; charset=utf-8" }, JSON.stringify(payload, null, 2));
}

function requireSetupToken(req, token) {
  const supplied = req.headers["x-telegram-agent-setup-token"];
  if (supplied !== token) throw new SetupError("Invalid setup token.", 403);
}

function isLocalHostHeader(req) {
  const host = String(req.headers.host || "").toLowerCase();
  return host.startsWith("127.0.0.1:") || host.startsWith("localhost:") || host === "127.0.0.1" || host === "localhost";
}

async function handleApi(req, res, runtime, token, pathname) {
  if (!isLocalHostHeader(req)) throw new SetupError("Setup server only accepts localhost requests.", 403);
  requireSetupToken(req, token);

  if (req.method === "GET" && pathname === "/api/status") {
    return writeJson(res, 200, publicStatus(runtime));
  }

  if (req.method !== "POST") throw new SetupError("Method not allowed.", 405);
  const body = await readJsonBody(req);

  if (pathname === "/api/save-config") {
    authStore.writeConfig(body);
    runtime.state = "config_ready";
    runtime.latest_error = null;
    addEvent(runtime, "config_saved", "Telegram API credentials saved.", "success");
    return writeJson(res, 200, publicStatus(runtime));
  }
  if (pathname === "/api/start-qr") return writeJson(res, 200, await startQrFlow(runtime));
  if (pathname === "/api/start-phone") return writeJson(res, 200, await startPhoneFlow(runtime, body.phone));
  if (pathname === "/api/submit-code") {
    const code = String(body.code || "").trim();
    if (!/^\d{3,10}$/.test(code)) throw new SetupError("Telegram login code must be numeric.");
    resolveWaiter(runtime, "code", code);
    addEvent(runtime, "code_submitted", "Telegram login code submitted.", "info");
    return writeJson(res, 200, publicStatus(runtime));
  }
  if (pathname === "/api/submit-password") {
    const password = String(body.password || "");
    if (!password) throw new SetupError("2FA password is required.");
    resolveWaiter(runtime, "password", password);
    addEvent(runtime, "password_submitted", "2FA password submitted.", "info");
    return writeJson(res, 200, publicStatus(runtime));
  }
  if (pathname === "/api/cancel") {
    await resetFlow(runtime, "cancelled by user");
    addEvent(runtime, "cancelled", "Setup flow cancelled.", "info");
    return writeJson(res, 200, publicStatus(runtime));
  }

  throw new SetupError("Unknown endpoint.", 404);
}

function openBrowser(url) {
  const platform = os.platform();
  let child;
  if (platform === "win32") {
    child = spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true });
  } else if (platform === "darwin") {
    child = spawn("open", [url], { detached: true, stdio: "ignore" });
  } else {
    child = spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
  }
  child.unref();
}

function createHandler(runtime, token) {
  return async (req, res) => {
    try {
      const parsed = new URL(req.url || "/", "http://127.0.0.1");
      if (req.method === "GET" && (parsed.pathname === "/" || parsed.pathname === "/setup")) {
        const html = renderSetupPage({ csrfToken: token, initialStatus: publicStatus(runtime) });
        return writeResponse(
          res,
          200,
          {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Security-Policy": "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"
          },
          html
        );
      }
      if (parsed.pathname.startsWith("/api/")) {
        return await handleApi(req, res, runtime, token, parsed.pathname);
      }
      throw new SetupError("Not found.", 404);
    } catch (error) {
      const statusCode = error instanceof SetupError ? error.statusCode : 500;
      writeJson(res, statusCode, { error: safeError(error) });
    }
  };
}

async function startSetupServer(options = {}) {
  if (activeInstance && activeInstance.server.listening) {
    if (options.open_browser) openBrowser(activeInstance.url);
    return activeInstance;
  }

  const host = options.host || DEFAULT_HOST;
  const port = Number.isInteger(Number(options.port)) ? Number(options.port) : 0;
  const token = crypto.randomBytes(32).toString("hex");
  const runtime = createRuntime();
  runtime.state = authStore.authStatus().state;
  addEvent(runtime, "server_started", "Local setup server started.", "info");

  const server = http.createServer(createHandler(runtime, token));
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  const url = `http://${host}:${address.port}/setup`;
  activeInstance = {
    server,
    runtime,
    token,
    url,
    port: address.port,
    host,
    close: () => new Promise((resolve) => server.close(resolve))
  };

  if (options.open_browser !== false) openBrowser(url);
  return activeInstance;
}

function parseCliArgs(argv) {
  const args = { port: 0, open_browser: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--no-open") args.open_browser = false;
    if (arg === "--port") args.port = Number(argv[index + 1] || 0);
  }
  return args;
}

if (require.main === module) {
  startSetupServer(parseCliArgs(process.argv.slice(2)))
    .then((instance) => {
      console.log(`Telegram Agent setup wizard: ${instance.url}`);
      console.log("This server is bound to 127.0.0.1 and stores state locally only.");
    })
    .catch((error) => {
      console.error(`Setup server failed: ${safeError(error)}`);
      process.exitCode = 1;
    });
}

module.exports = {
  SetupError,
  createRuntime,
  publicStatus,
  safeError,
  startSetupServer
};
