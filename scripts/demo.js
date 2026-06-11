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

function markdownList(items, formatter) {
  if (!items.length) return "- None\n";
  return `${items.map((item) => `- ${formatter(item)}`).join("\n")}\n`;
}

function printOssReport(loaded) {
  const digest = intelligence.telegramRunTopicDigest({ topic: "AI Codex MCP", period: "last_24h", source_categories: ["ai"], limit: 100 });
  const needsReply = intelligence.telegramNeedsReply({ period: "last_24h", limit: 20 });
  const issueDrafts = intelligence.telegramCreateGithubIssueDrafts({ period: "last_7d", repo: "Frejihyesos/telegram-agent", limit: 5 });
  const safety = intelligence.telegramDetectPromptInjection({ period: "last_7d", min_severity: "medium", limit: 10 });
  const context = intelligence.telegramBuildMaintainerContext({ period: "last_7d", topic: "Codex MCP", limit: 100 });
  const lines = [
    "# Telegram Agent OSS Evidence Report",
    "",
    "## Demo Dataset",
    `- Synthetic sources: ${loaded.source_count}`,
    `- Synthetic messages: ${loaded.message_count}`,
    "- Real Telegram data: none",
    "",
    "## Maintainer Intelligence Signals",
    `- Digest clusters: ${digest.clusters.length}`,
    `- Pending reply threads: ${needsReply.count}`,
    `- GitHub issue drafts: ${issueDrafts.count}`,
    `- Prompt-injection findings: ${safety.count}`,
    `- Context pack id: ${context.context_id}`,
    "",
    "## Example Issue Drafts",
    markdownList(issueDrafts.drafts, (draft) => `${draft.title} [${draft.labels.join(", ")}] evidence=${draft.evidence.map((message) => message.message_ref).join(", ")}`),
    "## Safety Findings",
    markdownList(safety.findings, (finding) => `${finding.severity}: ${finding.message_ref} (${finding.rules.map((rule) => rule.id).join(", ")})`),
    "## Why This Matters",
    "- Converts Telegram support noise into maintainer-ready GitHub issue drafts.",
    "- Builds compact Codex context packs with message refs instead of raw chat dumps.",
    "- Detects untrusted Telegram messages that try to control the agent or steal secrets.",
    "- Runs locally with no hosted backend and no real Telegram data in the demo."
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
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
  if (command === "prompt-injection") {
    print({
      loaded,
      result: intelligence.telegramDetectPromptInjection({ period: "last_7d", min_severity: "medium", limit: 20 })
    });
    return;
  }
  if (command === "issue-drafts") {
    print({
      loaded,
      result: intelligence.telegramCreateGithubIssueDrafts({ period: "last_7d", repo: "Frejihyesos/telegram-agent", limit: 10 })
    });
    return;
  }
  if (command === "context") {
    print({
      loaded,
      result: intelligence.telegramBuildMaintainerContext({ period: "last_7d", topic: "Codex MCP", limit: 100 })
    });
    return;
  }
  if (command === "oss-report") {
    printOssReport(loaded);
    return;
  }
  if (command === "personal-digest") {
    print({
      loaded,
      result: intelligence.telegramDailyPersonalDigest({ period: "last_24h", include_channels: false, limit: 100 })
    });
    return;
  }
  if (command === "smart-inbox") {
    print({
      loaded,
      result: intelligence.telegramSmartInbox({ period: "last_24h", include_channels: false, limit: 20 })
    });
    return;
  }
  if (command === "memory-search") {
    print({
      loaded,
      result: intelligence.telegramMemorySearch({ query: "address", period: "last_24h", limit: 20 })
    });
    return;
  }
  if (command === "contact-brief") {
    print({
      loaded,
      result: intelligence.telegramContactBrief({ chat: "Maria", period: "last_24h", limit: 50 })
    });
    return;
  }
  if (command === "personal-followups") {
    print({
      loaded,
      result: intelligence.telegramPersonalFollowups({ period: "last_24h", include_channels: false, limit: 20 })
    });
    return;
  }
  if (command === "sensitive-search") {
    print({
      loaded,
      result: intelligence.telegramSensitiveSearch({ period: "last_24h", query: "password", limit: 20 })
    });
    return;
  }
  if (command === "personal-briefing") {
    print({
      loaded,
      result: intelligence.telegramPersonalBriefing({ period: "last_24h", include_channels: false, limit: 100 })
    });
    return;
  }
  throw new Error(`Unknown demo command: ${command}`);
}

main();
