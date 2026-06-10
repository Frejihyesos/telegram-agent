"use strict";

function renderSetupPage({ csrfToken, initialStatus }) {
  const tokenJson = JSON.stringify(String(csrfToken || ""));
  const statusJson = JSON.stringify(initialStatus || {});
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Telegram Agent Setup</title>
  <style>
    :root {
      --bg: #09090b;
      --panel: #141417;
      --panel-soft: #1c1c21;
      --field: #202026;
      --text: #f4f4f5;
      --muted: #a1a1aa;
      --border: #2d2d34;
      --accent: #229ed9;
      --accent-strong: #1c8cbd;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #f43f5e;
      --radius: 8px;
      --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      line-height: 1.5;
    }
    .shell { max-width: 1120px; margin: 0 auto; padding: 36px 22px; }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 22px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 30px;
    }
    h1, h2, p { margin-top: 0; }
    h1 { font-size: 18px; margin-bottom: 0; letter-spacing: 0; }
    h2 { font-size: 17px; margin-bottom: 20px; letter-spacing: 0; }
    .title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .badge {
      display: inline-flex;
      align-items: center;
      min-height: 22px;
      padding: 3px 8px;
      border-radius: 5px;
      border: 1px solid var(--border);
      color: var(--muted);
      background: #18181b;
      font: 600 11px/1 var(--mono);
      text-transform: uppercase;
    }
    .badge.status { color: #d4d4d8; }
    .badge.config_ready, .badge.waiting_qr, .badge.waiting_code { color: var(--accent); border-color: rgba(34, 158, 217, .45); }
    .badge.waiting_password { color: #c084fc; border-color: rgba(192, 132, 252, .45); }
    .badge.logged_in { color: var(--success); border-color: rgba(16, 185, 129, .45); }
    .badge.error { color: var(--danger); border-color: rgba(244, 63, 94, .45); }
    .layout { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 36px; align-items: start; }
    .steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .step {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 12px;
      border-radius: var(--radius);
      border: 1px solid transparent;
      color: var(--muted);
      font-size: 13px;
      font-weight: 650;
    }
    .step span:first-child {
      display: grid;
      place-items: center;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #25252b;
      color: var(--muted);
      font: 700 11px/1 var(--mono);
    }
    .step.active { color: var(--text); background: var(--panel); border-color: var(--border); }
    .step.active span:first-child { color: white; background: var(--accent); }
    .step.done { color: var(--success); }
    .step.done span:first-child { color: var(--success); background: rgba(16, 185, 129, .12); border: 1px solid rgba(16, 185, 129, .35); }
    .panel {
      display: none;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 28px;
      box-shadow: 0 16px 48px rgba(0, 0, 0, .32);
    }
    .panel.active { display: block; }
    .muted { color: var(--muted); font-size: 13px; }
    .grid { display: grid; gap: 18px; }
    label { display: block; margin-bottom: 7px; color: var(--muted); font: 700 11px/1 var(--mono); text-transform: uppercase; letter-spacing: .04em; }
    input {
      width: 100%;
      min-height: 42px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--field);
      color: var(--text);
      padding: 9px 12px;
      outline: none;
      font: 13px/1.3 var(--mono);
    }
    input:focus-visible { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(34, 158, 217, .15); }
    input:disabled, button:disabled { opacity: .55; cursor: not-allowed; }
    a { color: #5bbce8; text-decoration: none; }
    a:hover { color: white; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 20px; }
    button, .link-button {
      min-height: 40px;
      border: 1px solid transparent;
      border-radius: var(--radius);
      padding: 9px 14px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 700;
      color: white;
      background: var(--accent);
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    button:hover:not(:disabled), .link-button:hover { background: var(--accent-strong); }
    button.secondary, .link-button.secondary { color: #e4e4e7; background: #1f1f23; border-color: var(--border); }
    button.secondary:hover:not(:disabled), .link-button.secondary:hover { background: #27272a; }
    button.danger { color: #fda4af; background: rgba(244, 63, 94, .08); border-color: rgba(244, 63, 94, .35); }
    .method-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; border: 1px solid var(--border); border-radius: var(--radius); background: #18181b; margin-bottom: 22px; }
    .method-tabs button { background: transparent; border: 0; color: var(--muted); }
    .method-tabs button.active { color: var(--text); background: var(--panel); border: 1px solid var(--border); }
    .qr-box {
      display: grid;
      place-items: center;
      min-height: 270px;
      padding: 24px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: #050506;
      margin-bottom: 16px;
    }
    .qr-box svg, .qr-box img { width: 220px; height: 220px; display: block; background: white; padding: 10px; border-radius: 6px; }
    .details {
      display: grid;
      grid-template-columns: 150px minmax(0, 1fr);
      gap: 10px 14px;
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: #0f0f12;
      font-size: 13px;
    }
    .details b { color: var(--muted); font: 700 11px/1.6 var(--mono); text-transform: uppercase; }
    .details code { color: white; font-family: var(--mono); word-break: break-all; }
    .alert {
      display: none;
      margin-bottom: 18px;
      padding: 12px 14px;
      border-radius: var(--radius);
      border: 1px solid rgba(244, 63, 94, .35);
      color: #fda4af;
      background: rgba(244, 63, 94, .08);
      font-size: 13px;
    }
    .log { margin-top: 30px; padding-top: 20px; border-top: 1px solid var(--border); }
    .log h3 { color: var(--muted); font: 700 11px/1 var(--mono); text-transform: uppercase; letter-spacing: .08em; margin: 0 0 10px; }
    .console {
      height: 170px;
      overflow: auto;
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: #020203;
      color: #e4e4e7;
      font: 12px/1.6 var(--mono);
    }
    .console div { margin-bottom: 4px; white-space: pre-wrap; }
    .time { color: #666672; margin-right: 8px; }
    .ok { color: var(--success); }
    .warn { color: var(--warning); }
    .err { color: var(--danger); }
    @media (max-width: 780px) {
      .shell { padding: 24px 14px; }
      header { align-items: flex-start; flex-direction: column; }
      .layout { grid-template-columns: 1fr; gap: 22px; }
      .panel { padding: 20px; }
      .details { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header>
      <div class="title-row">
        <h1>Telegram Agent Setup</h1>
        <span class="badge">127.0.0.1</span>
        <span class="badge">Local only</span>
      </div>
      <span id="statusBadge" class="badge status" aria-live="polite">Not configured</span>
    </header>

    <div id="alert" class="alert" aria-live="assertive"></div>

    <main class="layout">
      <nav aria-label="Setup steps">
        <ol class="steps">
          <li id="step1" class="step active"><span>1</span> API credentials</li>
          <li id="step2" class="step"><span>2</span> Login method</li>
          <li id="step3" class="step"><span>3</span> Verification</li>
          <li id="step4" class="step"><span>4</span> Ready</li>
        </ol>
      </nav>

      <section>
        <div id="panelCredentials" class="panel active">
          <h2>Telegram API credentials</h2>
          <p class="muted">Create an app at <a href="https://my.telegram.org/apps" target="_blank" rel="noopener noreferrer">my.telegram.org/apps</a>, then paste the API ID and API hash here. The hash is saved locally only.</p>
          <form id="credentialsForm" class="grid">
            <div>
              <label for="apiId">API ID</label>
              <input id="apiId" name="api_id" inputmode="numeric" autocomplete="off" required>
            </div>
            <div>
              <label for="apiHash">API Hash</label>
              <input id="apiHash" name="api_hash" autocomplete="off" spellcheck="false" required>
            </div>
            <div class="actions">
              <button type="submit">Save credentials</button>
            </div>
          </form>
        </div>

        <div id="panelMethod" class="panel">
          <h2>Choose login method</h2>
          <div class="method-tabs" role="tablist">
            <button id="qrTab" type="button" class="active" aria-selected="true">QR login</button>
            <button id="phoneTab" type="button" aria-selected="false">Phone code</button>
          </div>
          <div id="qrMethod">
            <p class="muted">Recommended. Open Telegram mobile, go to Settings > Devices > Link Desktop Device, and scan the local QR code.</p>
            <div class="actions">
              <button id="startQr" type="button">Generate QR code</button>
            </div>
          </div>
          <form id="phoneMethod" style="display:none">
            <p class="muted">Fallback when QR is unavailable. Telegram may rate-limit repeated code requests.</p>
            <label for="phone">Phone number</label>
            <input id="phone" name="phone" type="tel" autocomplete="tel" placeholder="+15551234567">
            <div class="actions">
              <button type="submit">Send login code</button>
            </div>
          </form>
        </div>

        <div id="panelVerify" class="panel">
          <h2>Telegram verification</h2>
          <div id="qrVerify">
            <div id="qrBox" class="qr-box"><span class="muted">Waiting for QR code...</span></div>
            <p id="qrTimer" class="muted" aria-live="polite"></p>
            <div class="actions">
              <a id="telegramLink" class="link-button secondary" href="#" rel="noopener">Open Telegram link</a>
              <button id="refreshQr" type="button" class="secondary">Refresh QR</button>
              <button id="cancelFlow1" type="button" class="danger">Cancel</button>
            </div>
          </div>
          <form id="codeVerify" style="display:none">
            <label for="loginCode">Login code</label>
            <input id="loginCode" autocomplete="one-time-code" inputmode="numeric">
            <div class="actions">
              <button type="submit">Submit code</button>
              <button id="cancelFlow2" type="button" class="danger">Cancel</button>
            </div>
          </form>
          <form id="passwordVerify" style="display:none">
            <p class="muted">This account has Telegram 2FA enabled. The password is sent once to Telegram and is never saved.</p>
            <label for="twoFactorPassword">2FA password</label>
            <input id="twoFactorPassword" type="password" autocomplete="current-password">
            <div class="actions">
              <button type="submit">Submit password</button>
              <button id="cancelFlow3" type="button" class="danger">Cancel</button>
            </div>
          </form>
        </div>

        <div id="panelReady" class="panel">
          <h2>Ready</h2>
          <p class="muted">Telegram Agent is authorized. Restart or refresh Codex if the MCP server was already running before setup.</p>
          <div class="details">
            <b>Display name</b><code id="readyName"></code>
            <b>Username</b><code id="readyUsername"></code>
            <b>User ID</b><code id="readyUserId"></code>
            <b>Config</b><code id="pathConfig"></code>
            <b>Session</b><code id="pathSession"></code>
            <b>SQLite</b><code id="pathSqlite"></code>
          </div>
          <div class="actions">
            <button id="closeButton" type="button" class="secondary">Close tab</button>
          </div>
        </div>

        <div class="log">
          <h3>Setup events</h3>
          <div id="console" class="console" aria-live="polite"></div>
        </div>
      </section>
    </main>
  </div>

  <script>
    window.__SETUP_TOKEN__ = ${tokenJson};
    window.__INITIAL_STATUS__ = ${statusJson};
  </script>
  <script>${renderClientScript()}</script>
</body>
</html>`;
}

function renderClientScript() {
  return `
const statusLabels = {
  not_configured: "Not configured",
  config_ready: "Config ready",
  waiting_qr: "Waiting for QR scan",
  waiting_code: "Waiting for code",
  waiting_password: "Waiting for 2FA",
  logged_in: "Logged in",
  error: "Error"
};

let currentState = "not_configured";
let pollTimer = null;
let countdownTimer = null;
let qrObjectUrl = null;

const byId = (id) => document.getElementById(id);

function setText(id, value) {
  const el = byId(id);
  if (el) el.textContent = value || "";
}

function setDisplay(id, display) {
  const el = byId(id);
  if (el) el.style.display = display;
}

function logEvent(message, type = "info") {
  const box = byId("console");
  if (!box) return;
  const row = document.createElement("div");
  const time = document.createElement("span");
  time.className = "time";
  time.textContent = new Date().toTimeString().slice(0, 8);
  const tag = document.createElement("span");
  tag.className = type === "error" ? "err" : type === "success" ? "ok" : type === "warning" ? "warn" : "";
  tag.textContent = "[" + type.toUpperCase() + "] ";
  row.appendChild(time);
  row.appendChild(tag);
  row.appendChild(document.createTextNode(maskSecretText(String(message || ""))));
  box.appendChild(row);
  box.scrollTop = box.scrollHeight;
}

function maskSecretText(value) {
  return value.replace(/(api_hash|password|session|token|code)=?[^\\s]*/gi, "$1=[redacted]");
}

function showError(message) {
  const el = byId("alert");
  el.textContent = maskSecretText(message || "Request failed.");
  el.style.display = "block";
}

function hideError() {
  const el = byId("alert");
  el.style.display = "none";
  el.textContent = "";
}

function setBusy(busy) {
  document.querySelectorAll("button, input").forEach((el) => {
    if (busy) el.setAttribute("disabled", "true");
    else el.removeAttribute("disabled");
  });
}

async function requestJson(method, url, body) {
  hideError();
  setBusy(true);
  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Agent-Setup-Token": window.__SETUP_TOKEN__
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await response.text();
    let payload = {};
    try { payload = text ? JSON.parse(text) : {}; } catch {}
    if (!response.ok || payload.error) {
      throw new Error(payload.error || "HTTP " + response.status);
    }
    return payload;
  } catch (error) {
    showError(error.message);
    logEvent(error.message, "error");
    throw error;
  } finally {
    setBusy(false);
  }
}

function activateStep(step) {
  for (let index = 1; index <= 4; index += 1) {
    const item = byId("step" + index);
    item.classList.toggle("active", index === step);
    item.classList.toggle("done", index < step);
  }
  const panels = [
    ["panelCredentials", step === 1],
    ["panelMethod", step === 2],
    ["panelVerify", step === 3],
    ["panelReady", step === 4]
  ];
  panels.forEach(([id, active]) => byId(id).classList.toggle("active", active));
}

function renderStatus(status) {
  if (!status) return;
  currentState = status.state || "not_configured";
  const badge = byId("statusBadge");
  badge.className = "badge status " + currentState;
  badge.textContent = statusLabels[currentState] || currentState;

  if (status.api_id) byId("apiId").value = String(status.api_id);
  if (status.api_hash_masked && !byId("apiHash").value) byId("apiHash").placeholder = status.api_hash_masked;

  if (currentState === "not_configured") activateStep(1);
  if (currentState === "config_ready") activateStep(2);
  if (currentState === "waiting_qr" || currentState === "waiting_code" || currentState === "waiting_password" || currentState === "error") activateStep(3);
  if (currentState === "logged_in") activateStep(4);

  setDisplay("qrVerify", currentState === "waiting_qr" ? "block" : "none");
  setDisplay("codeVerify", currentState === "waiting_code" ? "block" : "none");
  setDisplay("passwordVerify", currentState === "waiting_password" ? "block" : "none");

  if (currentState === "waiting_qr") renderQr(status);
  if (currentState === "logged_in") renderReady(status);
  if (status.latest_error) showError(status.latest_error);
  if (Array.isArray(status.events)) renderEvents(status.events);
  if (currentState === "logged_in") stopPolling();
}

function renderQr(status) {
  const qrBox = byId("qrBox");
  const svg = String(status.qr_svg || "").trim();
  if (svg.startsWith("<svg") && svg.endsWith("</svg>")) {
    if (qrObjectUrl) URL.revokeObjectURL(qrObjectUrl);
    qrObjectUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const img = document.createElement("img");
    img.alt = "Telegram login QR code";
    img.src = qrObjectUrl;
    qrBox.replaceChildren(img);
  } else {
    qrBox.textContent = "Waiting for QR code...";
  }
  const link = byId("telegramLink");
  if (status.login_url) link.setAttribute("href", status.login_url);
  if (status.expires_at) startCountdown(status.expires_at);
}

function renderReady(status) {
  const account = status.account || {};
  const paths = status.paths || {};
  setText("readyName", account.display_name || "not loaded");
  setText("readyUsername", account.username ? "@" + account.username : "none");
  setText("readyUserId", account.user_id || "not loaded");
  setText("pathConfig", paths.config_path || "");
  setText("pathSession", paths.session_path || "");
  setText("pathSqlite", paths.sqlite_path || "");
}

function renderEvents(events) {
  const box = byId("console");
  box.replaceChildren();
  events.slice(-30).forEach((event) => logEvent(event.message || event.type || "event", event.level || "info"));
}

function startCountdown(expiresAt) {
  stopCountdown();
  const target = new Date(expiresAt).getTime();
  const tick = () => {
    const remaining = target - Date.now();
    if (remaining <= 0) {
      setText("qrTimer", "QR expired. Generate a new code.");
      stopCountdown();
      return;
    }
    const seconds = Math.floor(remaining / 1000) % 60;
    const minutes = Math.floor(remaining / 60000);
    setText("qrTimer", "Expires in " + String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0"));
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

function stopCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = null;
}

async function pollStatus() {
  try {
    const response = await fetch("/api/status", {
      method: "GET",
      headers: { "X-Telegram-Agent-Setup-Token": window.__SETUP_TOKEN__ }
    });
    if (response.ok) renderStatus(await response.json());
  } catch {}
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollStatus();
  pollTimer = setInterval(pollStatus, 1500);
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  stopCountdown();
}

function selectMethod(method) {
  const qr = method === "qr";
  byId("qrTab").classList.toggle("active", qr);
  byId("phoneTab").classList.toggle("active", !qr);
  byId("qrTab").setAttribute("aria-selected", qr ? "true" : "false");
  byId("phoneTab").setAttribute("aria-selected", qr ? "false" : "true");
  setDisplay("qrMethod", qr ? "block" : "none");
  setDisplay("phoneMethod", qr ? "none" : "block");
}

byId("credentialsForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = await requestJson("POST", "/api/save-config", {
    api_id: byId("apiId").value.trim(),
    api_hash: byId("apiHash").value.trim()
  });
  byId("apiHash").value = "";
  logEvent("credentials saved", "success");
  renderStatus(status);
});

byId("qrTab").addEventListener("click", () => selectMethod("qr"));
byId("phoneTab").addEventListener("click", () => selectMethod("phone"));
byId("startQr").addEventListener("click", async () => renderStatus(await requestJson("POST", "/api/start-qr")));
byId("refreshQr").addEventListener("click", async () => renderStatus(await requestJson("POST", "/api/start-qr")));
byId("phoneMethod").addEventListener("submit", async (event) => {
  event.preventDefault();
  renderStatus(await requestJson("POST", "/api/start-phone", { phone: byId("phone").value.trim() }));
});
byId("codeVerify").addEventListener("submit", async (event) => {
  event.preventDefault();
  renderStatus(await requestJson("POST", "/api/submit-code", { code: byId("loginCode").value.trim() }));
  byId("loginCode").value = "";
});
byId("passwordVerify").addEventListener("submit", async (event) => {
  event.preventDefault();
  renderStatus(await requestJson("POST", "/api/submit-password", { password: byId("twoFactorPassword").value }));
  byId("twoFactorPassword").value = "";
});
["cancelFlow1", "cancelFlow2", "cancelFlow3"].forEach((id) => byId(id).addEventListener("click", async () => renderStatus(await requestJson("POST", "/api/cancel"))));
byId("closeButton").addEventListener("click", () => window.close());

logEvent("setup page loaded", "info");
renderStatus(window.__INITIAL_STATUS__);
startPolling();
`;
}

module.exports = {
  renderClientScript,
  renderSetupPage
};
