# Google Ads Lead Form to CRM Relay Runbook

## Production contract

Inbound flow:

`Google Ads lead form -> /api/google-lead-webhook -> durable Netlify Blob outbox -> signed Apps Script receiver -> IMPORT STAGING -> LEADS`

The Google Ads Data Manager connection used for sold-lead feedback is a separate outbound workflow. CSV export remains a manual backfill and reconciliation path; it is not the live inbound transport.

This relay does not send customer email or SMS and does not call an external marketing or direct-mail platform. Logs and scheduled summaries contain operational metadata only.

## Authentication and routing boundary

Google's raw lead-form webhook does not carry the Google Ads customer account ID. The authenticated inbound boundary is therefore:

1. An exact allowlist containing only form IDs `357496832026` and `398917236265`.
2. A unique Google webhook key for each form, compared in constant time.
3. A production routing value of account ID `7880085811`, injected by trusted Netlify configuration and bound into the HMAC-signed internal payload.

The account ID is a routing assertion, not evidence supplied by Google. Do not claim that the raw webhook proves the customer account ID. The form allowlist and per-form keys are the source-authentication controls.

Required production environment variables:

| Name | Exact requirement |
| --- | --- |
| `GOOGLE_ADS_ACCOUNT_ID` | `7880085811` |
| `GOOGLE_LEAD_FORM_ID_ALLOWLIST` | `357496832026,398917236265` in that order, with no spaces |
| `LHI_SITE_ENV` | Exact value `production`; Functions scope; Production deploy context only |
| `GOOGLE_LEAD_WEBHOOK_KEY_357496832026` | 32 random bytes encoded as 43 unpadded base64url characters; configured on the Free Health Insurance Quote form |
| `GOOGLE_LEAD_WEBHOOK_KEY_398917236265` | A different 32-byte, 43-character unpadded base64url key; configured on the Medicare Plan Review form |
| `HUFFSHERPA_LEAD_WEBHOOK_URL_V1` | Pinned Apps Script production deployment URL matching `https://script.google.com/macros/s/<deployment-id>/exec` |
| `HUFFSHERPA_LEAD_WEBHOOK_HMAC_SECRET_V1` | Independent 48-byte random secret encoded as 64 unpadded base64url characters |

Netlify serverless runtimes supply the read-only `SITE_ID`, which must exactly match `b6ad2d8f-d771-44f4-89b5-7ab30350950e`. The build-only `CONTEXT` value may be absent at runtime and cannot authorize intake. Configure `LHI_SITE_ENV=production` in Netlify's site environment with Functions scope and the Production deploy context only; the values in `netlify.toml` are build-side settings and do not establish this runtime control. All listed application variables must be production-scoped and unavailable to deploy previews and branch deploys.

The legacy `GOOGLE_WEBHOOK_KEY` and single-key `GOOGLE_LEAD_WEBHOOK_KEY` names are not accepted. Do not infer, copy, or reuse either value. The two form keys must differ from each other and from the internal HMAC secret.
Google Ads limits the webhook key field to 50 characters; the relay rejects a configured key longer than that limit.

## Intake behavior

- Unknown or blank form IDs fail before storage or delivery.
- A key valid for one approved form is invalid for the other form.
- Missing, reordered, expanded, or otherwise changed account/form routing configuration fails closed.
- `is_test=true` validates the full authenticated path and must receive `TEST_ACKNOWLEDGED`; it does not write an outbox or CRM lead.
- Production records are stored durably before the first Apps Script delivery attempt.
- Exact `lead_id` replays are acknowledged without another delivery. A changed payload using the same `lead_id` is quarantined.
- Only the approved contact columns and Google attribution identifiers enter the minimized signed payload. The account ID, form ID, creative ID, and asset-group ID remain distinct fields.

## Retry and retention behavior

The scheduled `google-lead-crm-retry` function runs every 15 minutes.

- Each run lists the 16 `lead/<hex>` hash shards in parallel through the `@netlify/blobs` paginated `AsyncIterable`. It consumes at most one page per shard, probes at most one additional page only to detect overflow, and retains at most 128 candidate keys from each shard.
- A metadata-only lexicographic checkpoint rotates through the candidate set. At most 32 records are read per run with at most 8 concurrent Blob reads. `scan_rotated=true` is normal bounded rotation; `scan_limited=true` means a shard overflowed or returned an invalid list item and requires operator attention.
- Up to 10 due deliveries are attempted per run.
- Up to 25 payload-purge, invalid-record scrub, or tombstone-delete actions are attempted per run with at most 5 maintenance workers.
- Transient receiver results such as lock contention, row races, staging-capacity or header issues, receiver secret unavailability, signature/envelope rejection, stale envelopes, and Google identity/schema contract mismatch remain pending with exponential backoff. These are receiver availability or deployment-contract failures, not proof that a lead is permanently invalid.
- Invalid or conflicting lead data is quarantined for review instead of retried indefinitely.
- Retry attempts are capped at 12.
- Successful delivery strips the lead payload immediately. Other payloads become eligible for privacy purge after 7 days; because scheduled work and Blob availability are bounded, actual purge is best effort and can lag the eligibility time.
- A corrupt record discovered during a scan is compare-and-set replaced with a metadata-only failure tombstone; the original bytes are represented only by a domain-separated SHA-256 digest.
- After payload removal, metadata-only terminal tombstones become eligible for deletion after 30 additional days. Deletion uses a compare-and-set `DELETING` lease and a final strong-consistency read so concurrent cleanup cannot delete a replacement record. Actual deletion remains best effort and can lag eligibility.
- Payload purge and tombstone deletion continue even when Apps Script endpoint, signing, or Google routing configuration is unavailable.

Every scheduled run emits one `google_ads_crm_relay_summary` event. `ATTENTION_REQUIRED` is emitted when configuration is unavailable, records are invalid/failed/quarantined, deliveries or maintenance are deferred, transient delivery failures occur, or a shard scan is limited. The production scheduled wrapper then throws controlled reason `relay_attention_required`, marking the invocation failed so configured Netlify failed-function notifications can alert an operator. Summary and failure fields are counts and controlled reason codes only; they contain no lead ID, click ID, contact information, payload, Blob key, or secret.

## Activation sequence

Activation is a separate approval gate from source changes.

1. Confirm the Apps Script receiver's reviewed source and tests match the signed envelope contract.
2. Create the two distinct Google form keys and the independent internal HMAC secret without placing values in source, tickets, logs, or chat.
3. Configure the exact production Netlify variables listed above.
4. Deploy the Apps Script receiver as the approved `huff.dave@gmail.com` identity and capture its pinned `/exec` URL.
5. Deploy the reviewed Netlify release.
6. Set `/api/google-lead-webhook` and the corresponding unique key on each Google Ads form.
7. Run one Google test for each form. Verify HTTP 200, `TEST_ACKNOWLEDGED`, zero new outbox records, and zero new CRM leads.
8. Submit one separately approved synthetic production-path validation only if explicitly authorized. Verify one staging row, one LEADS record, exact replay no-op, and no contact data in logs.
9. Review the scheduled summary after the next retry interval and confirm `HEALTHY`.
10. Confirm Netlify failed-function notifications are enabled for the scheduled function and that a controlled synthetic configuration failure reaches only the approved operational channel without payload data.

Do not activate a form if any required variable is absent, either form uses the other form's key, the Apps Script deployment URL is not pinned, the visible Apps Script account is not `huff.dave@gmail.com`, or any test creates a live customer record unexpectedly.

## Offline verification

Run these without invoking a browser, Netlify preview, live function, Apps Script, Google Ads, or production endpoint:

```sh
node --check netlify/functions/google-lead-webhook.mjs
node --check netlify/functions/google-lead-crm-retry.mjs
node --check netlify/functions/lib/google-ads-crm-relay.mjs
node --test tests/google-lead-webhook.test.mjs
git diff --check
```

Before a release candidate, run the repository's authoritative offline validator when browser execution has been separately confirmed unnecessary or explicitly authorized.

## Incident response

- `configuration_reason` present: repair configuration; retention maintenance will continue independently.
- `transient_delivery_failures` greater than zero: inspect the controlled reason and the Apps Script execution log; do not export payloads into logs.
- `quarantined_records` greater than zero: review source-ID or schema conflicts without manually uploading attribution unless Google match evidence is present.
- `scan_rotated=true`: normal bounded checkpoint rotation; no escalation by itself.
- `scan_limited`, `due_deferred`, or `maintenance_deferred` present: monitor successive runs. Escalate if the condition does not clear; `scan_limited` specifically means the bounded shard listing could not claim complete candidate coverage.
- Unexpected customer messaging or an unapproved downstream call: disable the Google Ads form webhook and Netlify function route, preserve metadata-only evidence, and investigate before reactivation.
