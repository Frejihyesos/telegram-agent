const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "telegram-agent-auth-"));
delete process.env.TELEGRAM_STRING_SESSION;
delete process.env.TELEGRAM_API_ID;
delete process.env.TELEGRAM_API_HASH;
process.env.TELEGRAM_AGENT_DATA_DIR = tempDir;
process.env.TELEGRAM_CONFIG_FILE = path.join(tempDir, "config.json");
process.env.TELEGRAM_SESSION_FILE = path.join(tempDir, "session.txt");
process.env.TELEGRAM_AGENT_DB_FILE = path.join(tempDir, "telegram-agent.sqlite");

const authStore = require("../scripts/auth-store");
const setupWeb = require("../scripts/setup-web");
const { callTool } = require("../scripts/telegram-agent-server");

test("auth status starts unconfigured and stores config metadata without api hash", () => {
  const initial = authStore.authStatus();
  assert.equal(initial.state, "not_configured");
  assert.equal(initial.api_id_configured, false);
  assert.equal(initial.api_hash_configured, false);

  authStore.writeConfig({ api_id: 12345, api_hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" });
  const status = authStore.authStatus();

  assert.equal(status.state, "config_ready");
  assert.equal(status.api_id, 12345);
  assert.equal(status.api_hash_masked, "********");
  assert.equal(Object.hasOwn(status, "api_hash"), false);
});

test("auth status records session fingerprint and account summary without full session", () => {
  const account = authStore.writeSession("1samplegramjssession", {
    id: 777,
    firstName: "Ada",
    lastName: "Lovelace",
    username: "ada"
  });
  const status = authStore.authStatus();

  assert.equal(account.display_name, "Ada Lovelace");
  assert.equal(status.state, "logged_in");
  assert.equal(status.session_configured, true);
  assert.equal(status.session_format, "gramjs_string");
  assert.match(status.session_fingerprint, /^[a-f0-9]{12}$/);
  assert.equal(Object.hasOwn(status, "session_sha256"), false);
});

test("setup server serves local page and protects API with setup token", async (t) => {
  const instance = await setupWeb.startSetupServer({ open_browser: false, port: 0 });
  t.after(async () => {
    await instance.close();
  });

  const pageResponse = await fetch(instance.url);
  const page = await pageResponse.text();
  assert.equal(pageResponse.status, 200);
  assert.match(page, /Telegram Agent Setup/);

  const blocked = await fetch(`http://${instance.host}:${instance.port}/api/status`);
  assert.equal(blocked.status, 403);

  const allowed = await fetch(`http://${instance.host}:${instance.port}/api/status`, {
    headers: { "X-Telegram-Agent-Setup-Token": instance.token }
  });
  const status = await allowed.json();
  assert.equal(allowed.status, 200);
  assert.equal(status.local_only, undefined);
  assert.equal(status.state, "logged_in");
});

test("MCP auth status tool returns local status without opening Telegram", async () => {
  const result = await callTool("telegram_auth_status", {});
  assert.equal(result.state, "logged_in");
  assert.equal(result.api_hash_masked, "********");
});
