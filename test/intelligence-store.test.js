const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

process.env.TELEGRAM_AGENT_DB_FILE = path.join(os.tmpdir(), `telegram-agent-test-${process.pid}.sqlite`);

const intelligence = require("../scripts/intelligence-store");

function cleanupDb() {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(`${process.env.TELEGRAM_AGENT_DB_FILE}${suffix}`);
    } catch {
      // Ignore missing test db files.
    }
  }
}

function loadSyntheticData() {
  cleanupDb();
  const now = Date.now();
  return intelligence.loadFixtureData({
    sources: [
      {
        ref: "@ai_one",
        id: "1",
        title: "AI One",
        username: "ai_one",
        type: "Channel",
        categories: ["ai", "dev"]
      },
      {
        ref: "Chat:team",
        id: "2",
        title: "Team Chat",
        type: "Chat",
        categories: ["work", "support"]
      }
    ],
    messages: [
      {
        source_ref: "@ai_one",
        message_id: 1,
        date: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
        outgoing: false,
        sender_id: "a",
        text: "OpenAI Codex update for maintainers https://example.com/codex"
      },
      {
        source_ref: "@ai_one",
        message_id: 2,
        date: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        outgoing: false,
        sender_id: "b",
        text: "Another Codex update for maintainers https://example.com/codex"
      },
      {
        source_ref: "Chat:team",
        message_id: 3,
        date: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
        outgoing: true,
        sender_id: "me",
        text: "I will check the Windows bug today."
      },
      {
        source_ref: "Chat:team",
        message_id: 4,
        date: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
        outgoing: false,
        sender_id: "alice",
        text: "Bug report: install fails on Windows. Can you create a GitHub issue?"
      }
    ]
  });
}

test("cache status and source suggestions work on synthetic data", () => {
  loadSyntheticData();
  const status = intelligence.telegramCacheStatus();
  assert.equal(status.source_count, 2);
  assert.equal(status.message_count, 4);

  const suggested = intelligence.telegramSuggestSources({ topic: "AI Codex", limit: 10 });
  assert.equal(suggested.count >= 1, true);
  assert.equal(suggested.sources[0].ref, "@ai_one");
});

test("topic digest deduplicates by URL and includes source evidence", () => {
  loadSyntheticData();
  const digest = intelligence.telegramRunTopicDigest({ topic: "Codex", period: "last_24h", source_categories: ["ai"] });
  assert.equal(digest.message_count, 2);
  assert.equal(digest.clusters.length, 1);
  assert.equal(digest.clusters[0].duplicate_count, 1);
  assert.deepEqual(digest.clusters[0].source_refs, ["@ai_one"]);
  assert.equal(digest.clusters[0].links[0].url, "https://example.com/codex");
});

test("needs reply and action extraction return message references", () => {
  loadSyntheticData();
  const needsReply = intelligence.telegramNeedsReply({ period: "last_24h" });
  assert.equal(needsReply.count, 1);
  assert.equal(needsReply.items[0].source_ref, "Chat:team");
  assert.equal(needsReply.items[0].latest_message_ref, "Chat:team:4");

  const actions = intelligence.telegramExtractActions({ period: "last_24h" });
  assert.equal(actions.items.some((item) => item.type === "bug_report" && item.message_ref === "Chat:team:4"), true);
  assert.equal(actions.items.some((item) => item.type === "question" && item.message_ref === "Chat:team:4"), true);
});

test("watchlists, research, and trends operate over cached messages", () => {
  loadSyntheticData();
  const created = intelligence.telegramCreateWatchlist({ name: "Codex", queries: ["Codex"], source_categories: ["ai"] });
  assert.equal(created.watchlist.name, "Codex");

  const watch = intelligence.telegramRunWatchlist({ name: "Codex", limit: 10 });
  assert.equal(watch.count, 2);

  const research = intelligence.telegramResearchTopic({ topic: "Codex", period: "last_24h" });
  assert.equal(research.findings.length >= 1, true);

  const trends = intelligence.telegramDetectTrends({ period: "last_24h" });
  assert.equal(trends.trends.some((trend) => trend.term.includes("codex")), true);
});

test("reply sessions are scoped and enforce max messages", () => {
  loadSyntheticData();
  const chat = { ref: "Chat:team", id: "2", title: "Team Chat" };
  const created = intelligence.createReplySession(
    {
      allowed_topic: "Windows install support",
      authorization_basis: "User authorized ongoing replies about Windows install support",
      max_messages: 1,
      expires_in_minutes: 10
    },
    chat
  );

  const session = intelligence.assertReplySessionForSend(chat, "Please try npm install again.", "Windows install support");
  assert.equal(session.session_id, created.session.session_id);
  intelligence.recordReplySessionSend(session.session_id);
  assert.throws(
    () => intelligence.assertReplySessionForSend(chat, "Second message", "Windows install support"),
    /max_messages/
  );
});
