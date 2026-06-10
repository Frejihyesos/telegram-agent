#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const command = process.argv[2] || "digest";
const demoDb = path.join(os.tmpdir(), `telegram-agent-demo-${command}-${process.pid}.sqlite`);
process.env.TELEGRAM_AGENT_DB_FILE = demoDb;

const intelligence = require("./intelligence-store");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resetDemoDb() {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(`${demoDb}${suffix}`);
    } catch {
      // Ignore missing demo db files.
    }
  }
}

function loadDemo() {
  resetDemoDb();
  const root = path.join(__dirname, "..");
  const sources = readJson(path.join(root, "fixtures", "demo-sources.json"));
  const rawMessages = readJson(path.join(root, "fixtures", "demo-messages.json"));
  const now = Date.now();
  const messages = rawMessages.map((message) => ({
    ...message,
    date: new Date(now - Number(message.age_hours || 0) * 60 * 60 * 1000).toISOString()
  }));
  return intelligence.loadFixtureData({ sources, messages });
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  const loaded = loadDemo();
  if (command === "digest") {
    print({
      loaded,
      result: intelligence.telegramRunTopicDigest({ topic: "AI Codex MCP", period: "last_24h", source_categories: ["ai"], limit: 100 })
    });
    return;
  }
  if (command === "needs-reply") {
    print({
      loaded,
      result: intelligence.telegramNeedsReply({ period: "last_24h", limit: 20 })
    });
    return;
  }
  if (command === "weekly-report") {
    print({
      loaded,
      result: intelligence.telegramWeeklyMaintainerReport({ period: "last_7d", limit: 100 })
    });
    return;
  }
  throw new Error(`Unknown demo command: ${command}`);
}

main();
