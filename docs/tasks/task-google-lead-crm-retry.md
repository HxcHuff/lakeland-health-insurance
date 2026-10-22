# Task: Investigate & Repair `google-lead-crm-retry` Netlify Function

**Date Created:** October 20, 2026  
**Status:** Queued for Tomorrow  
**Priority:** High (Cron disabled on production branch to eliminate 502 error spam)

---

## 1. Context & Background
In Netlify Observability for `lakelandhealthinsurance.com`, `google-lead-crm-retry` ran 270 times over 24h on a 15-minute cron (`*/15 * * * *`). It experienced a **58.5% 502/error rate** over 24h, spiking to **100% errors** in recent hours.

To eliminate error noise and prevent continuous failed executions, the cron schedule was commented out in `netlify.toml` on branch `fix/disable-google-lead-crm-retry`.

---

## 2. Technical Findings
- **Function Entry:** [`netlify/functions/google-lead-crm-retry.mjs`](file:///Users/david_huff/Documents/coding/lakeland-health-insurance/netlify/functions/google-lead-crm-retry.mjs)
- **Controlled Throw:** The retry handler calls `createRetryHandler({ env: getEnv, logger, failOnAttention: true })`. When `failOnAttention: true` is set, any metadata summary emitting `ATTENTION_REQUIRED` immediately triggers a controlled throw (`relay_attention_required`) so Netlify records a 502 execution failure and logs the incident.
- **Runbook:** See [`docs/google-ads-crm-relay-runbook.md`](file:///Users/david_huff/Documents/coding/lakeland-health-insurance/docs/google-ads-crm-relay-runbook.md) for full architecture and incident response steps.

---

## 3. Tomorrow's Investigation Checklist
1. **Examine Netlify Function Logs:**
   - Check Netlify Functions log output for `google-lead-crm-retry` to identify the exact controlled reason code (e.g. `configuration_reason`, `transient_delivery_failures`, `quarantined_records`, or missing env vars).
2. **Verify Required Environment Variables:**
   - Confirm in Netlify Site Settings (Functions scope, Production context) that all required variables are present and valid:
     - `GOOGLE_ADS_ACCOUNT_ID` (`7880085811`)
     - `GOOGLE_LEAD_FORM_ID_ALLOWLIST` (`357496832026,398917236265`)
     - `GOOGLE_LEAD_WEBHOOK_KEY_357496832026`
     - `GOOGLE_LEAD_WEBHOOK_KEY_398917236265`
     - `LEAD_BRIDGE_URL` (Vercel lead relay HTTPS origin)
     - `LEAD_BRIDGE_KEY` (shared bridge key)
     - `LHI_SITE_ENV` (`production`)
3. **Inspect Vercel Lead Bridge:**
   - Check the health and logs of `{LEAD_BRIDGE_URL}/` (`HxcHuff/google-ads-lead-relay`) and its write path to HubSpot portal `247504188`.
4. **Inspect Durable Netlify Blobs Outbox:**
   - Check if any lead records in `@netlify/blobs` are quarantined or failing delivery.
5. **Re-enable Schedule & Verify:**
   - Once the underlying issue is resolved and synthetic verification succeeds, re-enable the schedule (`*/15 * * * *`) in `netlify.toml` and verify `HEALTHY` summary output.
