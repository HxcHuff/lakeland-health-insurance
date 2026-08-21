import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGoogleLeadWebhook } from "../netlify/functions/google-lead-webhook.mjs";

const WEBHOOK_URL = "https://example.test/api/google-lead-webhook";
const SECRET = "synthetic-webhook-secret";

function makePayload(overrides = {}) {
  return {
    lead_id: "google-lead-123",
    api_version: "1.0",
    google_key: SECRET,
    is_test: false,
    gcl_id: "test-gclid-456",
    form_id: 11,
    campaign_id: 22,
    adgroup_id: 33,
    creative_id: 44,
    user_column_data: [
      { column_id: "FULL_NAME", string_value: "Jane Test" },
      { column_id: "EMAIL", string_value: "jane@example.com" },
      { column_id: "PHONE_NUMBER", string_value: "863-555-0100" },
      { column_id: "MARKETING_CONSENT", string_value: "yes" },
      { column_id: "PREFERRED_CONTACT_METHOD", string_value: "email" },
    ],
    ...overrides,
  };
}

function makeRequest(payload = makePayload(), init = {}) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  return new Request(WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json", ...(init.headers || {}) },
    body,
    ...init,
  });
}

function makeEnv(overrides = {}) {
  const values = { GOOGLE_LEAD_WEBHOOK_KEY: SECRET, ...overrides };
  return (key) => String(values[key] || "");
}

function makeAtomicStore() {
  const records = new Map();
  const calls = [];
  return {
    records,
    calls,
    async setJSON(key, value, options) {
      calls.push({ key, value, options });
      if (records.has(key)) return { modified: false };
      records.set(key, structuredClone(value));
      return { etag: `etag-${records.size}`, modified: true };
    },
  };
}

function makeHandler({ store = makeAtomicStore(), env = makeEnv(), fetchImpl, ...rest } = {}) {
  const fetchCalls = [];
  const resolvedFetch =
    fetchImpl ||
    (async (url, options) => {
      fetchCalls.push({ url: String(url), options });
      const status = String(url).includes("resend.com") ? 202 : 201;
      return new Response(null, { status });
    });

  return {
    store,
    fetchCalls,
    handler: createGoogleLeadWebhook({
      getStoreFn(name) {
        assert.equal(name, "google-lead-webhook-receipts-v1");
        return store;
      },
      env,
      fetchImpl: resolvedFetch,
      ...rest,
    }),
  };
}

async function captureLogs(run) {
  const logLines = [];
  const errorLines = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args) => logLines.push(args.join(" "));
  console.error = (...args) => errorLines.push(args.join(" "));
  try {
    const result = await run();
    return { result, logLines, errorLines };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

function parsedLogs(logLines, errorLines = []) {
  return [...logLines, ...errorLines].map((line) => JSON.parse(line));
}

test("first delivery is claimed once, excludes Mailchimp, and duplicate is acknowledged", async () => {
  const env = makeEnv({
    RESEND_API_KEY: "synthetic-resend-key",
    NOTIFY_EMAIL: "notifications@example.test",
    TWILIO_SID: "AC00000000000000000000000000000000",
    TWILIO_AUTH: "synthetic-twilio-auth",
    TWILIO_FROM: "+18635550101",
    TWILIO_TO: "+18635550102",
    MAILCHIMP_API_KEY: "synthetic-mailchimp-key",
    MAILCHIMP_AUDIENCE_ID: "audience-id",
    MAILCHIMP_SERVER_PREFIX: "us99",
  });
  const context = makeHandler({ env });

  const { result: responses, logLines, errorLines } = await captureLogs(async () => [
    await context.handler(makeRequest()),
    await context.handler(makeRequest()),
  ]);

  assert.deepEqual(
    responses.map((response) => response.status),
    [200, 200]
  );
  assert.equal(context.store.records.size, 1);
  assert.equal(context.store.calls.length, 2);
  assert.equal(context.fetchCalls.length, 2);
  assert.ok(context.fetchCalls.some((call) => call.url === "https://api.resend.com/emails"));
  assert.ok(context.fetchCalls.some((call) => call.url.includes("api.twilio.com")));
  assert.equal(context.fetchCalls.some((call) => call.url.includes("api.mailchimp.com")), false);

  const records = parsedLogs(logLines, errorLines);
  assert.ok(
    records.some(
      (record) =>
        record.component === "mailchimp" &&
        record.outcome === "skipped_no_verified_marketing_consent"
    )
  );
  assert.ok(
    records.some(
      (record) => record.component === "request" && record.outcome === "duplicate_acknowledged"
    )
  );
  assert.equal(
    records.filter(
      (record) =>
        record.component === "request" && record.outcome === "downstream_attempts_complete"
    ).length,
    1
  );
});

test("concurrent duplicate deliveries across handler instances have one claimant", async () => {
  const store = makeAtomicStore();
  const fetchCalls = [];
  const fetchImpl = async (url, options) => {
    fetchCalls.push({ url: String(url), options });
    return new Response(null, { status: 202 });
  };
  const env = makeEnv({ RESEND_API_KEY: "resend", NOTIFY_EMAIL: "notify@example.test" });
  const first = makeHandler({ store, env, fetchImpl }).handler;
  const second = makeHandler({ store, env, fetchImpl }).handler;

  const { result: responses, logLines, errorLines } = await captureLogs(() =>
    Promise.all([first(makeRequest()), second(makeRequest())])
  );

  assert.deepEqual(
    responses.map((response) => response.status),
    [200, 200]
  );
  assert.equal(store.records.size, 1);
  assert.equal(store.calls.length, 2);
  assert.equal(fetchCalls.length, 1);
  const records = parsedLogs(logLines, errorLines);
  assert.equal(records.filter((record) => record.outcome === "duplicate_acknowledged").length, 1);
  assert.equal(records.filter((record) => record.outcome === "downstream_attempts_complete").length, 1);
});

test("authentication-key rotation does not change receipt identity", async () => {
  const store = makeAtomicStore();
  const fetchCalls = [];
  const fetchImpl = async (url, options) => {
    fetchCalls.push({ url: String(url), options });
    return new Response(null, { status: 202 });
  };
  const oldSecret = "synthetic-old-webhook-key";
  const newSecret = "synthetic-new-webhook-key";
  const oldHandler = makeHandler({
    store,
    fetchImpl,
    env: makeEnv({
      GOOGLE_LEAD_WEBHOOK_KEY: oldSecret,
      RESEND_API_KEY: "resend",
      NOTIFY_EMAIL: "notify@example.test",
    }),
  }).handler;
  const newHandler = makeHandler({
    store,
    fetchImpl,
    env: makeEnv({
      GOOGLE_LEAD_WEBHOOK_KEY: newSecret,
      RESEND_API_KEY: "resend",
      NOTIFY_EMAIL: "notify@example.test",
    }),
  }).handler;

  const { result: responses } = await captureLogs(async () => [
    await oldHandler(makeRequest(makePayload({ google_key: oldSecret }))),
    await newHandler(makeRequest(makePayload({ google_key: newSecret }))),
  ]);

  assert.deepEqual(
    responses.map((response) => response.status),
    [200, 200]
  );
  assert.equal(store.records.size, 1);
  assert.equal(new Set(store.calls.map((call) => call.key)).size, 1);
  assert.equal(fetchCalls.length, 1);
});

test("different lead IDs are accepted independently", async () => {
  const env = makeEnv({ RESEND_API_KEY: "resend", NOTIFY_EMAIL: "notify@example.test" });
  const context = makeHandler({ env });

  const { result: responses } = await captureLogs(() =>
    Promise.all([
      context.handler(makeRequest(makePayload({ lead_id: "lead-a" }))),
      context.handler(makeRequest(makePayload({ lead_id: "lead-b" }))),
    ])
  );

  assert.deepEqual(
    responses.map((response) => response.status),
    [200, 200]
  );
  assert.equal(context.store.records.size, 2);
  assert.equal(context.fetchCalls.length, 2);
});

test("receipt and operational logs contain no contact data or Google identifiers", async () => {
  const context = makeHandler();
  const sensitiveValues = [
    "Jane Test",
    "jane@example.com",
    "863-555-0100",
    "google-lead-123",
    "test-gclid-456",
    SECRET,
  ];

  const { result: response, logLines, errorLines } = await captureLogs(() =>
    context.handler(makeRequest())
  );
  assert.equal(response.status, 200);
  assert.equal(errorLines.length, 0);

  assert.equal(context.store.calls.length, 1);
  const call = context.store.calls[0];
  assert.match(call.key, /^lead\/[0-9a-f]{64}$/);
  assert.deepEqual(call.value, { version: 1 });
  assert.deepEqual(call.options, { onlyIfNew: true });

  const persistedAndLogged = JSON.stringify({
    key: call.key,
    value: call.value,
    logs: [...logLines, ...errorLines],
  });
  for (const value of sensitiveValues) {
    assert.equal(persistedAndLogged.includes(value), false, `must not persist or log ${value}`);
  }

  const records = parsedLogs(logLines);
  assert.ok(records.length >= 5);
  assert.ok(records.every((record) => record.type === "google_lead_webhook_outcome_v1"));
  assert.ok(records.every((record) => /^[0-9a-f-]{36}$/.test(record.event_id)));
});

test("receipt-store failure is retryable and prevents downstream calls", async () => {
  const store = {
    calls: 0,
    async setJSON() {
      this.calls += 1;
      throw new Error("synthetic storage outage");
    },
  };
  const env = makeEnv({ RESEND_API_KEY: "resend", NOTIFY_EMAIL: "notify@example.test" });
  const context = makeHandler({ store, env });

  const { result: response, errorLines } = await captureLogs(() =>
    context.handler(makeRequest())
  );

  assert.equal(response.status, 503);
  assert.equal(store.calls, 1);
  assert.equal(context.fetchCalls.length, 0);
  const records = parsedLogs([], errorLines);
  assert.ok(
    records.some(
      (record) => record.component === "receipt_store" && record.outcome === "unavailable"
    )
  );
});

test("malformed payloads return controlled 4xx responses without storage or delivery", async () => {
  const cases = [
    { label: "invalid JSON", body: "{", status: 400 },
    { label: "null", body: "null", status: 400 },
    { label: "array", body: "[]", status: 400 },
    { label: "missing lead_id", body: makePayload({ lead_id: undefined }), status: 400 },
    { label: "object lead_id", body: makePayload({ lead_id: { value: "x" } }), status: 400 },
    { label: "oversized lead_id", body: makePayload({ lead_id: "x".repeat(513) }), status: 400 },
    { label: "missing field array", body: makePayload({ user_column_data: undefined }), status: 400 },
    { label: "object field array", body: makePayload({ user_column_data: {} }), status: 400 },
    { label: "malformed field item", body: makePayload({ user_column_data: [null] }), status: 400 },
    {
      label: "non-string field value",
      body: makePayload({ user_column_data: [{ column_id: "EMAIL", string_value: ["x"] }] }),
      status: 400,
    },
  ];

  for (const entry of cases) {
    const context = makeHandler();
    const { result: response } = await captureLogs(() =>
      context.handler(makeRequest(entry.body))
    );
    assert.equal(response.status, entry.status, entry.label);
    assert.equal(context.store.calls.length, 0, `${entry.label}: no storage`);
    assert.equal(context.fetchCalls.length, 0, `${entry.label}: no delivery`);
  }

  const context = makeHandler();
  const { result: oversizedResponse } = await captureLogs(() =>
    context.handler(
      makeRequest(makePayload(), { headers: { "content-length": String(64 * 1024 + 1) } })
    )
  );
  assert.equal(oversizedResponse.status, 413);
  assert.equal(context.store.calls.length, 0);
  assert.equal(context.fetchCalls.length, 0);
});

test("authentication rejection, missing server key, and test payload bypass all I/O", async () => {
  const badKey = makeHandler();
  const missingKey = makeHandler({ env: makeEnv({ GOOGLE_LEAD_WEBHOOK_KEY: "" }) });
  const testPayload = makeHandler({
    env: makeEnv({
      RESEND_API_KEY: "resend",
      NOTIFY_EMAIL: "notify@example.test",
      TWILIO_SID: "AC00000000000000000000000000000000",
      TWILIO_AUTH: "auth",
      TWILIO_FROM: "+18635550101",
      TWILIO_TO: "+18635550102",
      MAILCHIMP_API_KEY: "mailchimp",
    }),
  });

  const { result: responses } = await captureLogs(() =>
    Promise.all([
      badKey.handler(makeRequest(makePayload({ google_key: "wrong" }))),
      missingKey.handler(makeRequest()),
      testPayload.handler(
        makeRequest({ google_key: SECRET, is_test: true, user_column_data: [{ string_value: "x" }] })
      ),
    ])
  );

  assert.deepEqual(
    responses.map((response) => response.status),
    [403, 500, 200]
  );
  for (const context of [badKey, missingKey, testPayload]) {
    assert.equal(context.store.calls.length, 0);
    assert.equal(context.fetchCalls.length, 0);
  }
});

test("configured provider failures are contained and a retry does not duplicate attempts", async () => {
  const fetchCalls = [];
  const fetchImpl = async (url, options) => {
    fetchCalls.push({ url: String(url), options });
    if (String(url).includes("resend.com")) return new Response(null, { status: 503 });
    throw new Error("synthetic Twilio network failure");
  };
  const env = makeEnv({
    RESEND_API_KEY: "resend",
    NOTIFY_EMAIL: "notify@example.test",
    TWILIO_SID: "AC00000000000000000000000000000000",
    TWILIO_AUTH: "auth",
    TWILIO_FROM: "+18635550101",
    TWILIO_TO: "+18635550102",
  });
  const context = makeHandler({ env, fetchImpl });

  const { result: responses, logLines, errorLines } = await captureLogs(async () => [
    await context.handler(makeRequest()),
    await context.handler(makeRequest()),
  ]);

  assert.deepEqual(
    responses.map((response) => response.status),
    [200, 200]
  );
  assert.equal(fetchCalls.length, 2);
  const records = parsedLogs(logLines, errorLines);
  assert.ok(
    records.some(
      (record) => record.component === "email" && record.outcome === "failed" && record.status === 503
    )
  );
  assert.ok(records.some((record) => record.component === "sms" && record.outcome === "exception"));
  assert.ok(records.some((record) => record.outcome === "duplicate_acknowledged"));
});

test("source has no Mailchimp subscription implementation", async () => {
  const source = await readFile(
    new URL("../netlify/functions/google-lead-webhook.mjs", import.meta.url),
    "utf8"
  );
  assert.equal(source.includes('status: "subscribed"'), false);
  assert.equal(source.includes("api.mailchimp.com"), false);
  assert.equal(source.includes('env("MAILCHIMP_'), false);
});
