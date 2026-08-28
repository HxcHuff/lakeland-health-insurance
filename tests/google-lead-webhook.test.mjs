import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGoogleLeadWebhook } from "../netlify/functions/google-lead-webhook.mjs";
import {
  GOOGLE_ADS_ROUTING,
  OUTBOX,
  _test,
  canonicalJson,
  createRetryHandler,
} from "../netlify/functions/lib/google-ads-crm-relay.mjs";

const WEBHOOK_URL = "https://example.test/api/google-lead-webhook";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbSYNTHETIC_GOOGLE_ADS_RECEIVER_001/exec";
const CONTENT_SERVICE_URL = "https://script.googleusercontent.com/macros/echo?user_content_key=synthetic";
const GOOGLE_KEY = "synthetic-aca-google-webhook-key-0001";
const MEDICARE_GOOGLE_KEY = "synthetic-medicare-google-webhook-key-0002";
const OVERLONG_GOOGLE_KEY = Buffer.from(
  Array.from({ length: 38 }, (_, index) => index + 1),
).toString("base64url");
const HMAC_SECRET = Buffer.from(Array.from({ length: 48 }, (_, index) => index + 1)).toString("base64url");
const FIXED_NOW = Date.parse("2026-08-27T20:00:00.000Z");

function makePayload(overrides = {}) {
  return {
    lead_id: "Exact-Google-Lead_123",
    api_version: "1.0",
    google_key: GOOGLE_KEY,
    is_test: false,
    gcl_id: "Exact.Gclid_AbC-123~x",
    form_id: "357496832026",
    campaign_id: "24123358247",
    adgroup_id: "200750743844",
    creative_id: "820410157593",
    asset_group_id: "",
    lead_stage: "SUBMITTED",
    lead_submit_time: "2026-08-27T19:59:58Z",
    lead_source: "LEAD_FORM",
    user_column_data: [
      { column_id: "FIRST_NAME", column_name: "Ignore this label", string_value: "Jane" },
      { column_id: "LAST_NAME", string_value: "Test" },
      { column_id: "EMAIL", string_value: "Jane@Example.test" },
      { column_id: "PHONE_NUMBER", string_value: "+18635550100" },
      { column_id: "POSTAL_CODE", string_value: "33801" },
      { column_id: "MEDICAL_CONDITIONS", column_name: "Health history", string_value: "ignored" },
      { column_id: "CUSTOM_QUESTION", column_name: "EMAIL", string_value: "attacker@example.test" },
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
  const values = {
    CONTEXT: "",
    LHI_SITE_ENV: "production",
    SITE_ID: GOOGLE_ADS_ROUTING.siteId,
    GOOGLE_ADS_ACCOUNT_ID: GOOGLE_ADS_ROUTING.accountId,
    GOOGLE_LEAD_FORM_ID_ALLOWLIST: GOOGLE_ADS_ROUTING.formIds.join(","),
    GOOGLE_LEAD_WEBHOOK_KEY_357496832026: GOOGLE_KEY,
    GOOGLE_LEAD_WEBHOOK_KEY_398917236265: MEDICARE_GOOGLE_KEY,
    HUFFSHERPA_LEAD_WEBHOOK_URL_V1: APPS_SCRIPT_URL,
    HUFFSHERPA_LEAD_WEBHOOK_HMAC_SECRET_V1: HMAC_SECRET,
    ...overrides,
  };
  return (key) => String(values[key] || "");
}

function makeStore() {
  const records = new Map();
  const calls = [];
  let version = 0;
  return {
    records,
    calls,
    async set(key, data, options = {}) {
      calls.push({ method: "set", key, data, options: structuredClone(options) });
      const current = records.get(key);
      if (options.onlyIfNew && current) return { modified: false };
      if (options.onlyIfMatch && (!current || current.etag !== options.onlyIfMatch)) {
        return { modified: false };
      }
      version += 1;
      const etag = `\"etag-${version}\"`;
      records.set(key, {
        data,
        etag,
        metadata: structuredClone(options.metadata || {}),
      });
      return { modified: true, etag };
    },
    async getWithMetadata(key) {
      calls.push({ method: "get", key });
      const value = records.get(key);
      return value ? structuredClone(value) : null;
    },
    list(options = {}) {
      const { prefix } = options;
      calls.push({ method: "list", ...structuredClone(options) });
      const page = {
        blobs: [...records.entries()]
          .filter(([key]) => !prefix || key.startsWith(prefix))
          .map(([key, value]) => ({ key, etag: value.etag })),
        directories: [],
      };
      if (options.paginate) {
        return {
          async *[Symbol.asyncIterator]() {
            yield page;
          },
        };
      }
      return Promise.resolve(page);
    },
    async delete(key) {
      calls.push({ method: "delete", key });
      records.delete(key);
    },
  };
}

function makeAppsScriptFetch({ outcome = "STAGED", reason = null, failPost = false, onPost } = {}) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url) === APPS_SCRIPT_URL) {
      if (onPost) await onPost(options);
      if (failPost) throw new Error("synthetic network failure");
      return new Response(null, {
        status: 302,
        headers: { location: CONTENT_SERVICE_URL },
      });
    }
    assert.equal(String(url), CONTENT_SERVICE_URL);
    return new Response(JSON.stringify({ ok: !reason, outcome, reason }), {
      status: 200,
      headers: {
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8",
      },
    });
  };
  return { calls, fetchImpl };
}

function makeContext({
  store = makeStore(),
  env = makeEnv(),
  fetchImpl,
  now = () => FIXED_NOW,
  logger = () => {},
  ...rest
} = {}) {
  const storeFactoryCalls = [];
  const apps = fetchImpl ? { fetchImpl, calls: [] } : makeAppsScriptFetch();
  return {
    store,
    apps,
    storeFactoryCalls,
    handler: createGoogleLeadWebhook({
      env,
      fetchImpl: apps.fetchImpl,
      now,
      logger,
      randomBytes: () => Buffer.from(Array.from({ length: 32 }, (_, index) => 255 - index)),
      storeFactory: async () => {
        storeFactoryCalls.push(true);
        return store;
      },
      ...rest,
    }),
  };
}

function onlyRecord(store) {
  const records = [...store.records.entries()]
    .filter(([key]) => key.startsWith(OUTBOX.keyPrefix))
    .map(([, value]) => value);
  assert.equal(records.length, 1);
  return records[0];
}

function parsedRecord(store) {
  return JSON.parse(onlyRecord(store).data);
}

function leadKeys(store) {
  return [...store.records.keys()].filter((key) => key.startsWith(OUTBOX.keyPrefix)).sort();
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function verifyEnvelopeSignature(envelope) {
  const { signature, ...unsigned } = envelope;
  const expected = crypto.createHmac("sha256", Buffer.from(HMAC_SECRET, "utf8"))
    .update(canonicalJson(unsigned), "utf8")
    .digest("base64url");
  assert.equal(signature, expected);
}

test("durably stores a minimized payload before delivery, signs it, and closes without PII", async () => {
  const store = makeStore();
  let durableStateDuringPost = null;
  const apps = makeAppsScriptFetch({
    onPost() {
      durableStateDuringPost = parsedRecord(store).state;
    },
  });
  const logs = [];
  const context = makeContext({ store, fetchImpl: apps.fetchImpl, logger: (entry) => logs.push(entry) });

  const response = await context.handler(makeRequest());

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {});
  assert.equal(durableStateDuringPost, "ATTEMPTING");
  assert.equal(apps.calls.length, 2);
  const envelope = JSON.parse(apps.calls[0].options.body);
  verifyEnvelopeSignature(envelope);
  assert.deepEqual(Object.keys(envelope).sort(), ["issuedAt", "nonce", "payload", "signature", "source", "version"]);
  assert.equal(envelope.source, "google_ads");
  assert.equal(envelope.version, 1);
  assert.deepEqual(envelope.payload, {
    account_id: "7880085811",
    adgroup_id: "200750743844",
    asset_group_id: "",
    campaign_id: "24123358247",
    creative_id: "820410157593",
    email: "jane@example.test",
    event_type: "google_ads_lead_form_accepted",
    first_name: "Jane",
    form_id: "357496832026",
    gcl_id: "Exact.Gclid_AbC-123~x",
    is_test: false,
    last_name: "Test",
    lead_id: "Exact-Google-Lead_123",
    lead_source: "LEAD_FORM",
    lead_stage: "SUBMITTED",
    lead_submit_time: "2026-08-27T19:59:58Z",
    phone_number: "8635550100",
    postal_code: "33801",
  });
  assert.equal("user_column_data" in envelope.payload, false);
  assert.equal(JSON.stringify(envelope).includes("MEDICAL_CONDITIONS"), false);
  assert.equal(JSON.stringify(envelope).includes("attacker@example.test"), false);

  const stored = parsedRecord(store);
  assert.equal(stored.state, "CLOSED");
  assert.equal(stored.payload, null);
  const durableText = onlyRecord(store).data;
  for (const sensitive of [
    "Exact-Google-Lead_123",
    "Exact.Gclid_AbC-123~x",
    "jane@example.test",
    "+18635550100",
    "8635550100",
    "33801",
  ]) {
    assert.equal(durableText.includes(sensitive), false);
    assert.equal(JSON.stringify(logs).includes(sensitive), false);
  }
  assert.match([...store.records.keys()][0], /^lead\/[a-f0-9]{64}$/);

  const unsafeMetadata = { ...stored, last_reason: "jane@example.test" };
  assert.throws(() => _test.parseStoredRecord(canonicalJson(unsafeMetadata)), /outbox_record_invalid/u);
});

test("exact replay is a no-op while a changed replay is durably quarantined", async () => {
  const context = makeContext();
  const first = await context.handler(makeRequest());
  assert.equal(first.status, 200);
  const initialFetchCount = context.apps.calls.length;

  const exact = await context.handler(makeRequest());
  assert.equal(exact.status, 200);
  assert.equal(context.apps.calls.length, initialFetchCount);

  const changedPayload = makePayload({
    user_column_data: makePayload().user_column_data.map((item) => (
      item.column_id === "EMAIL" ? { ...item, string_value: "changed@example.test" } : item
    )),
  });
  const changed = await context.handler(makeRequest(changedPayload));
  assert.equal(changed.status, 409);
  assert.deepEqual(await changed.json(), { message: "source_id_payload_drift" });
  assert.equal(context.apps.calls.length, initialFetchCount);
  const record = parsedRecord(context.store);
  assert.equal(record.state, "QUARANTINED");
  assert.equal(record.last_reason, "source_id_payload_drift");
  assert.match(record.incoming_payload_sha256, /^[a-f0-9]{64}$/);
});

test("a changed replay racing an in-flight delivery wins quarantine over close", async () => {
  const store = makeStore();
  let handler;
  let nestedResponse;
  const apps = makeAppsScriptFetch({
    async onPost() {
      const changedPayload = makePayload({ gcl_id: "Changed.Gclid_456" });
      nestedResponse = await handler(makeRequest(changedPayload));
    },
  });
  const context = makeContext({ store, fetchImpl: apps.fetchImpl });
  handler = context.handler;

  const originalResponse = await handler(makeRequest());

  assert.equal(originalResponse.status, 200);
  assert.equal(nestedResponse.status, 409);
  assert.equal(parsedRecord(store).state, "QUARANTINED");
  assert.equal(parsedRecord(store).last_reason, "source_id_payload_drift");
});

test("transient delivery failure stays durable and the scheduled retry closes it", async () => {
  const store = makeStore();
  const failingApps = makeAppsScriptFetch({ failPost: true });
  const context = makeContext({ store, fetchImpl: failingApps.fetchImpl });

  const accepted = await context.handler(makeRequest());
  assert.equal(accepted.status, 200);
  assert.equal(parsedRecord(store).state, "PENDING");
  assert.equal(parsedRecord(store).last_reason, "upstream_network_error");
  assert.equal(parsedRecord(store).attempt_count, 1);

  const successfulApps = makeAppsScriptFetch();
  const retryLogs = [];
  const retry = createRetryHandler({
    env: makeEnv(),
    fetchImpl: successfulApps.fetchImpl,
    logger: (entry) => retryLogs.push(entry),
    now: () => FIXED_NOW + OUTBOX.retryBaseMilliseconds + 1,
    randomBytes: () => Buffer.alloc(32, 7),
    storeFactory: async () => store,
  });
  const retried = await retry();

  assert.equal(retried.status, 200);
  assert.deepEqual(await retried.json(), { ok: true, processed: 1 });
  assert.equal(successfulApps.calls.length, 2);
  assert.equal(parsedRecord(store).state, "CLOSED");
  assert.equal(parsedRecord(store).payload, null);
  assert.ok(retryLogs.some((entry) => entry.outcome === "CLOSED"));
});

test("scheduled retry bounds delivery work and reports deferred due records without identifiers", async () => {
  const store = makeStore();
  const context = makeContext({ store, fetchImpl: makeAppsScriptFetch({ failPost: true }).fetchImpl });
  const accepted = await context.handler(makeRequest());
  assert.equal(accepted.status, 200);
  const template = structuredClone([...store.records.values()][0]);
  for (let index = 1; index <= OUTBOX.maximumBatchSize; index += 1) {
    const key = `${OUTBOX.keyPrefix}${index.toString(16).padStart(64, "0")}`;
    store.records.set(key, { ...structuredClone(template), etag: `"seed-${index}"` });
  }

  const apps = makeAppsScriptFetch();
  const logs = [];
  const retry = createRetryHandler({
    env: makeEnv(),
    fetchImpl: apps.fetchImpl,
    logger: (entry) => logs.push(entry),
    now: () => FIXED_NOW + OUTBOX.retryBaseMilliseconds + 1,
    randomBytes: () => Buffer.alloc(32, 9),
    storeFactory: async () => store,
  });
  const response = await retry();

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, processed: OUTBOX.maximumBatchSize });
  assert.equal(apps.calls.length, OUTBOX.maximumBatchSize * 2);
  const states = [...store.records.values()].map(({ data }) => JSON.parse(data).state);
  assert.equal(states.filter((state) => state === "CLOSED").length, OUTBOX.maximumBatchSize);
  assert.equal(states.filter((state) => state === "PENDING").length, 1);
  const summary = logs.find((entry) => entry.event === "google_ads_crm_relay_summary");
  assert.equal(summary.scanned, OUTBOX.maximumBatchSize + 1);
  assert.equal(summary.due_deferred, 1);
  assert.equal(summary.outcome, "ATTENTION_REQUIRED");
  for (const sensitive of ["Exact-Google-Lead_123", "Exact.Gclid_AbC-123~x", "jane@example.test"]) {
    assert.equal(JSON.stringify(logs).includes(sensitive), false);
  }
});

test("scheduled scans use the Blobs AsyncIterable contract and a metadata-only rotating checkpoint", async () => {
  const store = makeStore();
  const context = makeContext({ store, fetchImpl: makeAppsScriptFetch({ failPost: true }).fetchImpl });
  const accepted = await context.handler(makeRequest());
  assert.equal(accepted.status, 200);
  const leadKey = [...store.records.keys()][0];

  const logs = [];
  const retry = createRetryHandler({
    env: makeEnv(),
    fetchImpl: makeAppsScriptFetch().fetchImpl,
    logger: (entry) => logs.push(entry),
    now: () => FIXED_NOW + OUTBOX.retryBaseMilliseconds + 1,
    randomBytes: () => Buffer.alloc(32, 8),
    storeFactory: async () => store,
  });
  const firstRun = await retry();
  assert.equal(firstRun.status, 200);
  assert.ok(store.records.has(OUTBOX.scanCursorKey));
  const checkpoint = JSON.parse(store.records.get(OUTBOX.scanCursorKey).data);
  assert.equal(checkpoint.cursor, leadKey);
  assert.equal(JSON.stringify(checkpoint).includes("Exact-Google-Lead_123"), false);
  const firstListCalls = store.calls.filter((call) => call.method === "list");
  assert.equal(firstListCalls.length, 16);
  assert.deepEqual(
    firstListCalls.map(({ prefix }) => prefix).sort(),
    "0123456789abcdef".split("").map((shard) => `${OUTBOX.keyPrefix}${shard}`),
  );
  assert.ok(firstListCalls.every((call) => call.paginate === true && !("cursor" in call)));
  assert.ok(logs.some((entry) => (
    entry.event === "google_ads_crm_relay_summary"
    && entry.scan_limited === false
    && entry.listed_candidates === 1
  )));

  const secondRun = await retry();
  assert.equal(secondRun.status, 200);
  assert.equal(JSON.parse(store.records.get(OUTBOX.scanCursorKey).data).cursor, leadKey);
  assert.ok(store.calls.filter((call) => call.method === "list").every((call) => !("cursor" in call)));
});

test("scheduled scanning is bounded, concurrent, and rotates across later candidates", async () => {
  const store = makeStore();
  const context = makeContext({ store, fetchImpl: makeAppsScriptFetch({ failPost: true }).fetchImpl });
  assert.equal((await context.handler(makeRequest())).status, 200);
  const template = structuredClone([...store.records.values()][0]);
  for (let index = 0; index < 64; index += 1) {
    const key = `${OUTBOX.keyPrefix}${index.toString(16).padStart(64, "0")}`;
    store.records.set(key, { ...structuredClone(template), etag: `"rotation-${index}"` });
  }

  const baseList = store.list.bind(store);
  store.list = (options = {}) => {
    const iterable = baseList(options);
    return {
      async *[Symbol.asyncIterator]() {
        await delay(50);
        yield* iterable;
      },
    };
  };
  const baseGetWithMetadata = store.getWithMetadata.bind(store);
  let activeLeadReads = 0;
  let maximumActiveLeadReads = 0;
  store.getWithMetadata = async (key, options) => {
    if (!key.startsWith(OUTBOX.keyPrefix)) return baseGetWithMetadata(key, options);
    activeLeadReads += 1;
    maximumActiveLeadReads = Math.max(maximumActiveLeadReads, activeLeadReads);
    try {
      await delay(50);
      return await baseGetWithMetadata(key, options);
    } finally {
      activeLeadReads -= 1;
    }
  };

  const logs = [];
  const maintenanceOnlyEnv = makeEnv({
    HUFFSHERPA_LEAD_WEBHOOK_URL_V1: "",
    HUFFSHERPA_LEAD_WEBHOOK_HMAC_SECRET_V1: "",
  });
  const retry = createRetryHandler({
    env: maintenanceOnlyEnv,
    logger: (entry) => logs.push(entry),
    now: () => FIXED_NOW + OUTBOX.retryBaseMilliseconds + 1,
    storeFactory: async () => store,
  });

  const firstCallOffset = store.calls.length;
  const startedAt = performance.now();
  assert.equal((await retry()).status, 200);
  const elapsedMilliseconds = performance.now() - startedAt;
  const firstReadKeys = store.calls.slice(firstCallOffset)
    .filter((call) => call.method === "get" && call.key.startsWith(OUTBOX.keyPrefix))
    .map(({ key }) => key);
  const firstSummary = logs.find((entry) => entry.event === "google_ads_crm_relay_summary");

  assert.equal(firstReadKeys.length, OUTBOX.maximumScanSize);
  assert.equal(new Set(firstReadKeys).size, OUTBOX.maximumScanSize);
  assert.equal(maximumActiveLeadReads, OUTBOX.maximumConcurrentRecordReads);
  assert.ok(elapsedMilliseconds < 900, `bounded scan took ${elapsedMilliseconds.toFixed(1)}ms`);
  assert.equal(firstSummary.scanned, OUTBOX.maximumScanSize);
  assert.equal(firstSummary.scan_rotated, true);
  assert.equal(firstSummary.scan_limited, false);
  assert.equal(firstSummary.listed_candidates, 65);

  const secondCallOffset = store.calls.length;
  assert.equal((await retry()).status, 200);
  const secondReadKeys = store.calls.slice(secondCallOffset)
    .filter((call) => call.method === "get" && call.key.startsWith(OUTBOX.keyPrefix))
    .map(({ key }) => key);
  assert.equal(secondReadKeys.length, OUTBOX.maximumScanSize);
  assert.equal(new Set(secondReadKeys).size, OUTBOX.maximumScanSize);
  assert.equal(firstReadKeys.some((key) => secondReadKeys.includes(key)), false);
});

test("scheduled retention purges payloads without relay configuration and later deletes bounded tombstones", async () => {
  const store = makeStore();
  const context = makeContext({ store, fetchImpl: makeAppsScriptFetch({ failPost: true }).fetchImpl });
  const accepted = await context.handler(makeRequest());
  assert.equal(accepted.status, 200);
  assert.notEqual(parsedRecord(store).payload, null);

  const logs = [];
  const maintenanceEnv = makeEnv({
    GOOGLE_ADS_ACCOUNT_ID: "",
    GOOGLE_LEAD_FORM_ID_ALLOWLIST: "",
    GOOGLE_LEAD_WEBHOOK_KEY_357496832026: "",
    GOOGLE_LEAD_WEBHOOK_KEY_398917236265: "",
    HUFFSHERPA_LEAD_WEBHOOK_URL_V1: "",
    HUFFSHERPA_LEAD_WEBHOOK_HMAC_SECRET_V1: "",
  });
  const purge = createRetryHandler({
    env: maintenanceEnv,
    logger: (entry) => logs.push(entry),
    now: () => FIXED_NOW + OUTBOX.retentionMilliseconds + 1,
    storeFactory: async () => store,
  });
  const purged = await purge();

  assert.equal(purged.status, 200);
  assert.deepEqual(await purged.json(), { ok: true, processed: 0 });
  const tombstone = parsedRecord(store);
  assert.equal(tombstone.state, "FAILED");
  assert.equal(tombstone.payload, null);
  assert.equal(tombstone.last_reason, "retention_expired");
  assert.equal(
    tombstone.expires_at,
    new Date(FIXED_NOW + OUTBOX.retentionMilliseconds + 1 + OUTBOX.tombstoneRetentionMilliseconds).toISOString(),
  );
  assert.ok(store.calls.some((call) => call.method === "list" && call.paginate === true));
  const purgeSummary = logs.find((entry) => entry.event === "google_ads_crm_relay_summary");
  assert.equal(purgeSummary.payloads_purged, 1);
  assert.equal(purgeSummary.configuration_reason, "google_ads_routing_configuration_unavailable");
  assert.equal(purgeSummary.outcome, "ATTENTION_REQUIRED");
  for (const sensitive of ["Exact-Google-Lead_123", "jane@example.test", "+18635550100"]) {
    assert.equal(JSON.stringify(logs).includes(sensitive), false);
  }

  const removeTombstone = createRetryHandler({
    env: maintenanceEnv,
    logger: (entry) => logs.push(entry),
    now: () => Date.parse(tombstone.expires_at) + 1,
    storeFactory: async () => store,
  });
  const removed = await removeTombstone();
  assert.equal(removed.status, 200);
  assert.equal([...store.records.keys()].filter((key) => key.startsWith(OUTBOX.keyPrefix)).length, 0);
  assert.equal(store.records.has(OUTBOX.scanCursorKey), true);
  assert.ok(logs.some((entry) => entry.event === "google_ads_crm_relay_summary" && entry.tombstones_deleted === 1));
});

test("scheduled maintenance caps payload purges and reports deferred work", async () => {
  const store = makeStore();
  const context = makeContext({ store, fetchImpl: makeAppsScriptFetch({ failPost: true }).fetchImpl });
  assert.equal((await context.handler(makeRequest())).status, 200);
  const template = structuredClone([...store.records.values()][0]);
  for (let index = 0; index < OUTBOX.maximumScanSize - 1; index += 1) {
    const key = `${OUTBOX.keyPrefix}${index.toString(16).padStart(64, "0")}`;
    store.records.set(key, { ...structuredClone(template), etag: `"maintenance-${index}"` });
  }
  const baseSet = store.set.bind(store);
  let activeMaintenanceWrites = 0;
  let maximumActiveMaintenanceWrites = 0;
  store.set = async (key, data, options) => {
    if (!key.startsWith(OUTBOX.keyPrefix) || !options?.onlyIfMatch) {
      return baseSet(key, data, options);
    }
    activeMaintenanceWrites += 1;
    maximumActiveMaintenanceWrites = Math.max(maximumActiveMaintenanceWrites, activeMaintenanceWrites);
    try {
      await delay(50);
      return await baseSet(key, data, options);
    } finally {
      activeMaintenanceWrites -= 1;
    }
  };
  const logs = [];
  const retry = createRetryHandler({
    env: makeEnv({ HUFFSHERPA_LEAD_WEBHOOK_URL_V1: "" }),
    logger: (entry) => logs.push(entry),
    now: () => FIXED_NOW + OUTBOX.retentionMilliseconds + 1,
    storeFactory: async () => store,
  });

  const startedAt = performance.now();
  assert.equal((await retry()).status, 200);
  const elapsedMilliseconds = performance.now() - startedAt;
  const summary = logs.find((entry) => entry.event === "google_ads_crm_relay_summary");
  assert.equal(maximumActiveMaintenanceWrites, OUTBOX.maximumConcurrentMaintenanceActions);
  assert.ok(elapsedMilliseconds < 800, `bounded maintenance took ${elapsedMilliseconds.toFixed(1)}ms`);
  assert.equal(summary.scanned, OUTBOX.maximumScanSize);
  assert.equal(summary.payloads_purged, OUTBOX.maximumMaintenanceActions);
  assert.equal(summary.maintenance_failures, 0);
  assert.equal(summary.maintenance_deferred, OUTBOX.maximumScanSize - OUTBOX.maximumMaintenanceActions);
  assert.equal(summary.outcome, "ATTENTION_REQUIRED");
});

test("invalid outbox data is CAS-scrubbed to a metadata-only tombstone", async () => {
  const store = makeStore();
  const sensitiveText = "Jane.Person@example.test Exact.Gclid_AbC-123~x 8635550100";
  const key = `${OUTBOX.keyPrefix}${"a".repeat(64)}`;
  store.records.set(key, {
    data: JSON.stringify({ corrupt: sensitiveText }),
    etag: '"corrupt-1"',
    metadata: { state: "PENDING" },
  });
  const logs = [];
  const retry = createRetryHandler({
    env: makeEnv({ HUFFSHERPA_LEAD_WEBHOOK_URL_V1: "" }),
    logger: (entry) => logs.push(entry),
    now: () => FIXED_NOW,
    storeFactory: async () => store,
  });

  assert.equal((await retry()).status, 200);
  const scrubbedText = store.records.get(key).data;
  const scrubbed = _test.parseStoredRecord(scrubbedText);
  assert.equal(scrubbed.state, "FAILED");
  assert.equal(scrubbed.payload, null);
  assert.equal(scrubbed.last_reason, "outbox_record_invalid");
  assert.equal(scrubbedText.includes(sensitiveText), false);
  assert.equal(JSON.stringify(logs).includes(sensitiveText), false);
  const summary = logs.find((entry) => entry.event === "google_ads_crm_relay_summary");
  assert.equal(summary.invalid_records, 1);
  assert.equal(summary.invalid_records_scrubbed, 1);
});

test("concurrent tombstone deletion cannot delete a replacement written after cleanup", async () => {
  const store = makeStore();
  const context = makeContext({ store });
  assert.equal((await context.handler(makeRequest())).status, 200);
  const key = leadKeys(store)[0];
  const raw = structuredClone(store.records.get(key));
  const entry = Object.freeze({ ...raw, record: _test.parseStoredRecord(raw.data) });
  const replacement = Object.freeze({ data: "replacement-record", etag: '"replacement"', metadata: {} });
  let deleteCalls = 0;
  store.delete = async (deletedKey) => {
    deleteCalls += 1;
    store.calls.push({ method: "delete", key: deletedKey });
    store.records.delete(deletedKey);
    store.records.set(deletedKey, replacement);
  };
  const expiredAt = Date.parse(entry.record.expires_at) + 1;

  const outcomes = await Promise.all([
    _test.deleteExpiredTombstone(store, key, entry, expiredAt),
    _test.deleteExpiredTombstone(store, key, entry, expiredAt),
  ]);

  assert.deepEqual(outcomes.sort(), [false, true]);
  assert.equal(deleteCalls, 1);
  assert.deepEqual(store.records.get(key), replacement);
});

test("controlled receiver rejection remains quarantined and is not closed", async () => {
  const apps = makeAppsScriptFetch({ outcome: "REJECTED", reason: "invalid_google_ads_data" });
  const context = makeContext({ fetchImpl: apps.fetchImpl });

  const response = await context.handler(makeRequest());

  assert.equal(response.status, 200);
  assert.equal(parsedRecord(context.store).state, "QUARANTINED");
  assert.equal(parsedRecord(context.store).last_reason, "invalid_google_ads_data");
  assert.notEqual(parsedRecord(context.store).payload, null);
});

test("receiver availability, configuration, and signed-contract failures remain retryable", async () => {
  for (const reason of [
    "staging_lock_unavailable",
    "hmac_secret_unavailable",
    "invalid_google_ads_payload",
    "invalid_webhook_signature",
    "invalid_source_fingerprint",
    "lead_formula_mismatch",
    "stale_webhook_envelope",
    "google_ads_identity_mismatch",
  ]) {
    const apps = makeAppsScriptFetch({ outcome: "REJECTED", reason });
    const logs = [];
    const context = makeContext({ fetchImpl: apps.fetchImpl, logger: (entry) => logs.push(entry) });

    const response = await context.handler(makeRequest());

    assert.equal(response.status, 200, reason);
    assert.equal(parsedRecord(context.store).state, "PENDING", reason);
    assert.equal(parsedRecord(context.store).last_reason, reason, reason);
    assert.equal(parsedRecord(context.store).attempt_count, 1, reason);
    assert.equal(
      parsedRecord(context.store).next_attempt_at,
      new Date(FIXED_NOW + OUTBOX.retryBaseMilliseconds).toISOString(),
      reason,
    );
    assert.ok(logs.some((entry) => entry.outcome === "PENDING" && entry.reason === reason), reason);
    for (const sensitive of ["Exact-Google-Lead_123", "jane@example.test", "8635550100"]) {
      assert.equal(JSON.stringify(logs).includes(sensitive), false, reason);
    }
  }
});

test("scheduled attention fails the invocation with metadata-only diagnostics", async () => {
  const store = makeStore();
  const context = makeContext({ store, fetchImpl: makeAppsScriptFetch({ failPost: true }).fetchImpl });
  assert.equal((await context.handler(makeRequest())).status, 200);
  const logs = [];
  const retry = createRetryHandler({
    env: makeEnv({ HUFFSHERPA_LEAD_WEBHOOK_URL_V1: "" }),
    failOnAttention: true,
    logger: (entry) => logs.push(entry),
    now: () => FIXED_NOW + OUTBOX.retryBaseMilliseconds + 1,
    storeFactory: async () => store,
  });

  await assert.rejects(retry, (error) => {
    assert.equal(error.code, "relay_attention_required");
    assert.equal(error.statusCode, 503);
    return true;
  });
  assert.ok(logs.some((entry) => (
    entry.event === "google_ads_crm_relay_summary"
    && entry.outcome === "ATTENTION_REQUIRED"
    && entry.configuration_reason === "relay_configuration_invalid"
  )));
  assert.ok(logs.some((entry) => entry.reason === "relay_attention_required"));
  for (const sensitive of ["Exact-Google-Lead_123", "jane@example.test", "8635550100"]) {
    assert.equal(JSON.stringify(logs).includes(sensitive), false);
  }
});

test("test data validates and reaches only the receiver TEST_ACKNOWLEDGED path", async () => {
  const apps = makeAppsScriptFetch({ outcome: "TEST_ACKNOWLEDGED" });
  const context = makeContext({
    fetchImpl: apps.fetchImpl,
    store: {
      async set() { throw new Error("test must not persist"); },
      async getWithMetadata() { throw new Error("test must not read outbox"); },
    },
  });

  const response = await context.handler(makeRequest(makePayload({ is_test: true })));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {});
  assert.equal(context.storeFactoryCalls.length, 0);
  assert.equal(apps.calls.length, 2);
  assert.equal(JSON.parse(apps.calls[0].options.body).payload.is_test, true);

  const missingConfiguration = makeContext({
    env: makeEnv({ HUFFSHERPA_LEAD_WEBHOOK_URL_V1: "" }),
    fetchImpl: apps.fetchImpl,
  });
  const failed = await missingConfiguration.handler(makeRequest(makePayload({ is_test: true })));
  assert.equal(failed.status, 503);
  assert.equal(missingConfiguration.storeFactoryCalls.length, 0);
});

test("Google Ads UI test omissions are normalized only for non-writing test data", async () => {
  const googleUiTestPayload = makePayload({ is_test: true });
  delete googleUiTestPayload.asset_group_id;
  delete googleUiTestPayload.lead_stage;
  delete googleUiTestPayload.lead_submit_time;
  delete googleUiTestPayload.lead_source;

  const apps = makeAppsScriptFetch({ outcome: "TEST_ACKNOWLEDGED" });
  const testContext = makeContext({ fetchImpl: apps.fetchImpl });
  const testResponse = await testContext.handler(makeRequest(googleUiTestPayload));
  assert.equal(testResponse.status, 200);
  assert.deepEqual(await testResponse.json(), {});
  assert.equal(testContext.storeFactoryCalls.length, 0);
  const envelope = JSON.parse(apps.calls[0].options.body);
  assert.equal(envelope.payload.is_test, true);
  assert.equal(envelope.payload.asset_group_id, "");
  assert.equal(envelope.payload.lead_stage, "");
  assert.equal(envelope.payload.lead_submit_time, "1970-01-01T00:00:00.000Z");
  assert.equal(envelope.payload.lead_source, "LEAD_FORM");

  const productionContext = makeContext();
  const productionResponse = await productionContext.handler(makeRequest({
    ...googleUiTestPayload,
    is_test: false,
    lead_id: "production-missing-required-fields",
  }));
  assert.equal(productionResponse.status, 400);
  assert.equal(productionContext.storeFactoryCalls.length, 0);
  assert.equal(productionContext.apps.calls.length, 0);
});

test("absent is_test is treated as a production lead", async () => {
  const payload = makePayload();
  delete payload.is_test;
  const context = makeContext();

  const response = await context.handler(makeRequest(payload));

  assert.equal(response.status, 200);
  assert.equal(JSON.parse(context.apps.calls[0].options.body).payload.is_test, false);
  assert.equal(parsedRecord(context.store).state, "CLOSED");
});

test("approved forms require distinct per-form keys and bind the configured Ads account", async () => {
  assert.equal(OVERLONG_GOOGLE_KEY.length, 51);
  const medicareApps = makeAppsScriptFetch();
  const medicare = makeContext({ fetchImpl: medicareApps.fetchImpl });
  const accepted = await medicare.handler(makeRequest(makePayload({
    account_id: "0000000000",
    form_id: "398917236265",
    google_key: MEDICARE_GOOGLE_KEY,
  })));
  assert.equal(accepted.status, 200);
  const envelope = JSON.parse(medicareApps.calls[0].options.body);
  assert.equal(envelope.payload.account_id, "7880085811");
  assert.equal(envelope.payload.form_id, "398917236265");

  const wrongFormKey = makeContext();
  const wrongFormKeyResponse = await wrongFormKey.handler(makeRequest(makePayload({
    form_id: "398917236265",
    google_key: GOOGLE_KEY,
  })));
  assert.equal(wrongFormKeyResponse.status, 403);
  assert.equal(wrongFormKey.store.records.size, 0);

  const unknownForm = makeContext();
  const unknownFormResponse = await unknownForm.handler(makeRequest(makePayload({ form_id: "999999999999" })));
  assert.equal(unknownFormResponse.status, 403);
  assert.equal(unknownForm.store.records.size, 0);

  for (const [label, overrides] of [
    ["missing account", { GOOGLE_ADS_ACCOUNT_ID: "" }],
    ["wrong account", { GOOGLE_ADS_ACCOUNT_ID: "1234567890" }],
    ["missing allowlist", { GOOGLE_LEAD_FORM_ID_ALLOWLIST: "" }],
    ["reordered allowlist", { GOOGLE_LEAD_FORM_ID_ALLOWLIST: "398917236265,357496832026" }],
    ["missing ACA key", { GOOGLE_LEAD_WEBHOOK_KEY_357496832026: "" }],
    ["weak ACA key", { GOOGLE_LEAD_WEBHOOK_KEY_357496832026: "a".repeat(64) }],
    ["ACA key exceeds Google's 50-character field limit", { GOOGLE_LEAD_WEBHOOK_KEY_357496832026: OVERLONG_GOOGLE_KEY }],
    ["shared form keys", { GOOGLE_LEAD_WEBHOOK_KEY_398917236265: GOOGLE_KEY }],
  ]) {
    const invalidConfiguration = makeContext({ env: makeEnv(overrides) });
    const response = await invalidConfiguration.handler(makeRequest());
    assert.equal(response.status, 503, label);
    assert.equal(invalidConfiguration.store.records.size, 0, `${label}: fail before storage`);
    assert.equal(invalidConfiguration.apps.calls.length, 0, `${label}: fail before delivery`);
  }

  const legacyOnly = makeContext({
    env: makeEnv({
      GOOGLE_LEAD_WEBHOOK_KEY: GOOGLE_KEY,
      GOOGLE_LEAD_WEBHOOK_KEY_357496832026: "",
      GOOGLE_LEAD_WEBHOOK_KEY_398917236265: "",
    }),
  });
  const legacyOnlyResponse = await legacyOnly.handler(makeRequest());
  assert.equal(legacyOnlyResponse.status, 503);
  assert.equal(legacyOnly.store.records.size, 0);
});

test("authentication and schema failures never store or deliver", async () => {
  const cases = [
    ["bad key", makePayload({ google_key: "wrong" }), 403],
    ["missing lead id", makePayload({ lead_id: undefined }), 400],
    ["oversized lead id", makePayload({ lead_id: "x".repeat(513) }), 400],
    ["invalid source", makePayload({ lead_source: "UNKNOWN" }), 400],
    ["invalid short phone", makePayload({
      user_column_data: [{ column_id: "PHONE_NUMBER", string_value: "555-0100" }],
    }), 400],
    ["overlong last name derived from full name", makePayload({
      user_column_data: [
        { column_id: "FULL_NAME", string_value: `A ${"B".repeat(101)}` },
        { column_id: "EMAIL", string_value: "jane@example.test" },
      ],
    }), 400],
    ["overlong campaign ID", makePayload({ campaign_id: "1".repeat(21) }), 400],
    ["invalid timestamp", makePayload({ lead_submit_time: "not-a-time" }), 400],
    ["non-string column", makePayload({ user_column_data: [{ column_id: "EMAIL", string_value: ["x"] }] }), 400],
    [
      "column_name is never an identity fallback",
      makePayload({ user_column_data: [{ column_id: "CUSTOM", column_name: "EMAIL", string_value: "x@example.test" }] }),
      400,
    ],
    [
      "duplicate approved column",
      makePayload({
        user_column_data: [
          { column_id: "EMAIL", string_value: "one@example.test" },
          { column_id: "EMAIL", string_value: "two@example.test" },
        ],
      }),
      400,
    ],
  ];

  for (const [label, payload, status] of cases) {
    const context = makeContext();
    const response = await context.handler(makeRequest(payload));
    assert.equal(response.status, status, label);
    const body = await response.json();
    assert.deepEqual(Object.keys(body), ["message"], `${label}: controlled Google error body`);
    assert.equal(context.storeFactoryCalls.length, 0, `${label}: no storage`);
    assert.equal(context.apps.calls.length, 0, `${label}: no delivery`);
  }

  const context = makeContext();
  const tooLarge = await context.handler(makeRequest(makePayload(), {
    headers: { "content-length": String(64 * 1024 + 1) },
  }));
  assert.equal(tooLarge.status, 413);
  assert.deepEqual(await tooLarge.json(), { message: "payload_too_large" });
  assert.equal(context.storeFactoryCalls.length, 0);
});

test("the signed receiver contract accepts both documented Google lead-source enums", async () => {
  for (const leadSource of ["LEAD_FORM", "CONVERSATIONAL_AGENT"]) {
    const context = makeContext();
    const response = await context.handler(makeRequest(makePayload({
      lead_id: `Exact-Google-${leadSource}`,
      lead_source: leadSource,
    })));
    assert.equal(response.status, 200, leadSource);
    assert.equal(JSON.parse(context.apps.calls[0].options.body).payload.lead_source, leadSource);
  }
});

test("production intake accepts a serverless runtime without build context", async () => {
  const context = makeContext({
    env: makeEnv({ CONTEXT: "" }),
    fetchImpl: makeAppsScriptFetch({ outcome: "TEST_ACKNOWLEDGED" }).fetchImpl,
  });
  const response = await context.handler(makeRequest(makePayload({ is_test: true })));
  assert.equal(response.status, 200);
  assert.equal(context.storeFactoryCalls.length, 0);
});

test("production intake independently rejects every invalid runtime context", async () => {
  const cases = [
    ["missing production marker", { LHI_SITE_ENV: "" }],
    ["preview marker", { LHI_SITE_ENV: "preview" }],
    ["missing site id", { SITE_ID: "" }],
    ["wrong site id", { SITE_ID: "00000000-0000-0000-0000-000000000000" }],
    ["build context cannot authorize a missing marker", { CONTEXT: "production", LHI_SITE_ENV: "" }],
    ["present preview build context vetoes exact runtime values", { CONTEXT: "deploy-preview" }],
  ];

  for (const [label, overrides] of cases) {
    const context = makeContext({ env: makeEnv(overrides) });
    const response = await context.handler(makeRequest());
    assert.equal(response.status, 503, label);
    assert.deepEqual(await response.json(), { message: "production_context_required" }, label);
    assert.equal(context.storeFactoryCalls.length, 0, label);
    assert.equal(context.apps.calls.length, 0, label);
  }
});

test("scheduled retry rejects invalid runtime context before Blob access", async () => {
  for (const [label, overrides] of [
    ["missing production marker", { LHI_SITE_ENV: "" }],
    ["wrong site id", { SITE_ID: "00000000-0000-0000-0000-000000000000" }],
  ]) {
    let storeFactoryCalls = 0;
    const retry = createRetryHandler({
      env: makeEnv(overrides),
      storeFactory: async () => {
        storeFactoryCalls += 1;
        return makeStore();
      },
    });
    const response = await retry();
    assert.equal(response.status, 503, label);
    assert.deepEqual(await response.json(), { ok: false, error: "production_context_required" }, label);
    assert.equal(storeFactoryCalls, 0, label);
  }
});

test("production intake rejects reused authentication secrets", async () => {

  const reused = makeContext({
    env: makeEnv({
      GOOGLE_LEAD_WEBHOOK_KEY_357496832026: HMAC_SECRET,
      HUFFSHERPA_LEAD_WEBHOOK_HMAC_SECRET_V1: HMAC_SECRET,
    }),
  });
  const reusedResponse = await reused.handler(makeRequest(makePayload({ google_key: HMAC_SECRET })));
  assert.equal(reusedResponse.status, 503);
  assert.equal(reused.store.records.size, 0);
  assert.equal(reused.apps.calls.length, 0);
});

test("test receiver cannot return an operational success outcome", async () => {
  const context = makeContext({ fetchImpl: makeAppsScriptFetch({ outcome: "STAGED" }).fetchImpl });
  const response = await context.handler(makeRequest(makePayload({ is_test: true })));
  assert.equal(response.status, 502);
  assert.equal(context.storeFactoryCalls.length, 0);
});

test("source has no customer messaging or external marketing delivery and retry is scheduled", async () => {
  const webhookSource = await readFile(
    new URL("../netlify/functions/google-lead-webhook.mjs", import.meta.url),
    "utf8",
  );
  const helperSource = await readFile(
    new URL("../netlify/functions/lib/google-ads-crm-relay.mjs", import.meta.url),
    "utf8",
  );
  const config = await readFile(new URL("../netlify.toml", import.meta.url), "utf8");
  const implementation = `${webhookSource}\n${helperSource}`;
  for (const prohibited of ["api.mailchimp.com", "api.twilio.com", "customer.io", "Customer.io"]) {
    assert.equal(implementation.includes(prohibited), false);
  }
  assert.match(config, /\[functions\."google-lead-crm-retry"\][\s\S]*schedule = "\*\/15 \* \* \* \*"/u);
});
