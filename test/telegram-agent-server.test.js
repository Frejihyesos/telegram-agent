const assert = require("node:assert/strict");
const test = require("node:test");

const {
  basicSessionFormat,
  buildChatStats,
  callTool,
  entitySummary,
  messageSummary,
  textFingerprint,
  validateAuthorizationBasis
} = require("../scripts/telegram-agent-server");

test("basicSessionFormat classifies missing and GramJS-looking sessions", () => {
  assert.equal(basicSessionFormat(""), "missing");
  assert.equal(basicSessionFormat("1abc"), "gramjs_string");
  assert.equal(basicSessionFormat("abc+/="), "not_gramjs_string_or_unknown");
  assert.equal(basicSessionFormat("not a token"), "unknown");
});

test("entitySummary builds stable refs without exposing extra entity data", () => {
  const summary = entitySummary({
    id: 42,
    className: "Api.User",
    firstName: "Ada",
    lastName: "Lovelace",
    username: "ada",
    bot: false,
    self: false
  });

  assert.equal(summary.ref, "@ada");
  assert.equal(summary.id, "42");
  assert.equal(summary.type, "User");
  assert.equal(summary.title, "Ada Lovelace");
  assert.equal(summary.username, "ada");
  assert.equal(summary.is_bot, false);
});

test("messageSummary redacts text when includeText is false", () => {
  const summary = messageSummary(
    {
      id: 7,
      date: new Date("2026-06-10T10:00:00.000Z"),
      out: false,
      senderId: 123,
      message: "private body",
      media: null
    },
    false
  );

  assert.equal(summary.id, 7);
  assert.equal(summary.date, "2026-06-10T10:00:00.000Z");
  assert.equal(summary.outgoing, false);
  assert.equal(summary.sender_id, "123");
  assert.equal(Object.hasOwn(summary, "text"), true);
  assert.equal(summary.text, undefined);
});

test("buildChatStats detects pending incoming messages, questions, and priority terms", () => {
  const stats = buildChatStats([
    {
      id: 1,
      date: new Date("2026-06-10T10:00:00.000Z"),
      out: false,
      senderId: 101,
      message: "When is the release?",
      media: null
    },
    {
      id: 2,
      date: new Date("2026-06-10T10:05:00.000Z"),
      out: true,
      senderId: 202,
      message: "Today.",
      media: null
    },
    {
      id: 3,
      date: new Date("2026-06-10T10:10:00.000Z"),
      out: false,
      senderId: 101,
      message: "\u0441\u0440\u043e\u0447\u043d\u043e please check this",
      media: null
    }
  ]);

  assert.equal(stats.total_messages, 3);
  assert.equal(stats.incoming_messages, 2);
  assert.equal(stats.outgoing_messages, 1);
  assert.equal(stats.pending_incoming_after_last_outgoing, 1);
  assert.equal(stats.latest_direction, "incoming");
  assert.equal(stats.recent_questions.length, 1);
  assert.equal(stats.recent_questions[0].id, 1);
  assert.equal(stats.recent_priority_terms.length, 1);
  assert.equal(stats.recent_priority_terms[0].id, 3);
});

test("validateAuthorizationBasis requires a meaningful note", () => {
  assert.throws(() => validateAuthorizationBasis("short"), /authorization_basis/);
  assert.equal(
    validateAuthorizationBasis("User explicitly authorized ongoing messages to Ivan in this task"),
    "User explicitly authorized ongoing messages to Ivan in this task"
  );
});

test("textFingerprint records length and a deterministic hash without full text", () => {
  const first = textFingerprint("private reply body");
  const second = textFingerprint("private reply body");

  assert.equal(first.text_length, 18);
  assert.equal(first.text_sha256, second.text_sha256);
  assert.match(first.text_sha256, /^[a-f0-9]{64}$/);
  assert.equal(Object.hasOwn(first, "text"), false);
});

test("direct send is blocked before Telegram connection when send env is disabled", async () => {
  const previous = process.env.TELEGRAM_AGENT_ALLOW_SEND;
  delete process.env.TELEGRAM_AGENT_ALLOW_SEND;

  await assert.rejects(
    () =>
      callTool("telegram_send_message", {
        chat: "me",
        text: "test",
        authorization_basis: "User explicitly authorized this resolved chat"
      }),
    /Sending is disabled/
  );

  if (previous === undefined) {
    delete process.env.TELEGRAM_AGENT_ALLOW_SEND;
  } else {
    process.env.TELEGRAM_AGENT_ALLOW_SEND = previous;
  }
});

test("unknown tools fail closed", async () => {
  await assert.rejects(() => callTool("telegram_bulk_spam", {}), /Unknown tool/);
});
