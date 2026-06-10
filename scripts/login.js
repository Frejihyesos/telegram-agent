#!/usr/bin/env node
"use strict";

const fs = require("fs");
const input = require("input");
const qrcode = require("qrcode-terminal");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const authStore = require("./auth-store");

const DATA_DIR = authStore.DATA_DIR;
const CONFIG_FILE = authStore.CONFIG_FILE;
const SESSION_FILE = authStore.SESSION_FILE;

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function readSession() {
  try {
    return fs.readFileSync(SESSION_FILE, "utf8").trim();
  } catch {
    return "";
  }
}

async function promptValue(label, currentValue) {
  const suffix = currentValue ? " [press Enter to keep current]" : "";
  const answer = await input.text(`${label}${suffix}: `);
  return answer.trim() || currentValue || "";
}

function displayAccount(user) {
  return user.username ? `@${user.username}` : [user.firstName, user.lastName].filter(Boolean).join(" ") || user.id;
}

function floodWaitSeconds(error) {
  const text = String(error && (error.errorMessage || error.message || error));
  const match = text.match(/wait of (\d+) seconds/i) || text.match(/FLOOD_WAIT_?(\d+)/i);
  return match ? Number(match[1]) : null;
}

function sanitizePhone(phoneNumber) {
  const trimmed = String(phoneNumber || "").trim();
  if (!trimmed) return "";
  const sign = trimmed.startsWith("+") ? "+" : "";
  return `${sign}${trimmed.replace(/[^\d]/g, "")}`;
}

async function saveLoggedInSession(client, user) {
  const session = client.session.save();
  authStore.writeSession(session, user);
  await client.disconnect();

  console.log("");
  console.log(`Logged in as ${displayAccount(user)}`);
  console.log(`Session saved to ${SESSION_FILE}`);
  console.log("Restart Codex or refresh the plugin before using Telegram Agent tools.");
}

async function loginWithQr(client, apiId, apiHash) {
  await client.connect();
  console.log("");
  console.log("QR login selected.");
  console.log("In Telegram mobile, open Settings > Devices > Link Desktop Device, then scan the QR code.");
  console.log("If the terminal QR does not scan, open the tg:// link on a device with Telegram installed.");

  const user = await client.signInUserWithQrCode(
    { apiId, apiHash },
    {
      qrCode: async ({ token, expires }) => {
        const link = `tg://login?token=${token.toString("base64url")}`;
        const expiresAt = expires instanceof Date ? expires.toISOString() : new Date(Number(expires) * 1000).toISOString();
        console.log("");
        console.log(`QR expires at: ${expiresAt}`);
        qrcode.generate(link, { small: true });
        console.log(link);
      },
      password: async () => input.password("Telegram 2FA password, if enabled: "),
      onError: async (error) => {
        console.error(`Telegram QR login error: ${error.message}`);
        return false;
      }
    }
  );

  await saveLoggedInSession(client, user);
}

async function loginWithPhone(client, apiId, apiHash) {
  const phoneNumber = sanitizePhone(await input.text("Phone number in international format, for example +15551234567: "));
  if (!phoneNumber) {
    throw new Error("Phone number is required.");
  }

  await client.start({
    phoneNumber: async () => phoneNumber,
    phoneCode: async () => input.text("Telegram login code: "),
    password: async () => input.password("Telegram 2FA password, if enabled: "),
    onError: (error) => {
      const seconds = floodWaitSeconds(error);
      if (seconds) {
        throw new Error(`Telegram rate limit: wait ${seconds} seconds before requesting another login code. Try QR login with: npm run login:qr`);
      }
      console.error(`Telegram login error: ${error.message}`);
    }
  });

  await saveLoggedInSession(client, await client.getMe());
}

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const config = readJson(CONFIG_FILE);
  const useQr = process.argv.includes("--qr");

  const apiIdRaw = await promptValue("Telegram api_id from https://my.telegram.org/apps", String(process.env.TELEGRAM_API_ID || config.api_id || ""));
  const apiId = Number(apiIdRaw);
  if (!Number.isInteger(apiId) || apiId <= 0) {
    throw new Error("api_id must be a positive integer.");
  }

  const apiHash = await promptValue("Telegram api_hash", String(process.env.TELEGRAM_API_HASH || config.api_hash || ""));
  if (!apiHash) {
    throw new Error("api_hash is required.");
  }

  authStore.writeConfig({ api_id: apiId, api_hash: apiHash });

  const client = new TelegramClient(new StringSession(readSession()), apiId, apiHash, {
    connectionRetries: 5
  });

  if (useQr) {
    await loginWithQr(client, apiId, apiHash);
  } else {
    await loginWithPhone(client, apiId, apiHash);
  }
}

main().catch((error) => {
  console.error(`Login failed: ${error.message}`);
  process.exitCode = 1;
});
