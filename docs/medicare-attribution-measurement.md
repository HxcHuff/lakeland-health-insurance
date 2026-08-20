# Medicare Attribution and Measurement Contract

Contract version: `medicare-attribution.v1`
Implementation date: 2026-08-14
Scope: the Lakeland Medicare broker content cluster, Get Help intake attribution, and Forms-acceptance measurement

This contract separates visitor behavior, first-party form acceptance, and downstream operational outcomes. Code or GA4 evidence from one boundary must not be reported as proof of a later boundary.

## Page Registry

| Path | `page_key` | `page_role` | `content_cluster` | Visitor task |
|---|---|---|---|---|
| `/best-medicare-broker-lakeland-fl/` | `best_medicare_broker_lakeland_fl` | `selection` | `lakeland_medicare_broker` | Evaluate a broker and the review methodology |
| `/medicare-broker-lakeland-fl/` | `medicare_broker_lakeland_fl` | `transaction` | `lakeland_medicare_broker` | Request a Medicare plan review |
| `/get-help/?intent=medicare...` | `get_help` | `intake` | `lakeland_medicare_broker` | Submit a privacy-bounded contact request |

Roles and cluster values come from the registry. Values supplied as `source_page_role` or `content_cluster` in a URL, hidden field, DOM text, or API request are not authoritative.

## CTA Registry

| Source role | CTA key | Destination class |
|---|---|---|
| Selection | `request_review_hero` | Get Help |
| Selection | `start_review_criteria` | Get Help |
| Selection | `request_help_final` | Get Help |
| Selection | `broker_help_nav` | Transaction page |
| Selection | `see_review_process` | Transaction page |
| Transaction | `request_review_hero` | Get Help |
| Transaction | `request_review_verification` | Get Help |
| Transaction | `request_review_final` | Get Help |
| Transaction | `selection_guide_nav` | Selection page |
| Either registered page | `menu_get_help` | Get Help |
| Either registered page | `header_talk_to_david` | Get Help |
| Either registered page | `footer_start_plan_review` | Get Help |

Primary Get Help links carry only `intent=medicare`, `source_page_key`, and `source_cta_key`. The intake derives the role and cluster. Validated `utm_source`, `utm_medium`, `utm_campaign`, and `utm_content` may be retained; values resembling contact data are rejected.

## Event and Outcome Boundaries

| Stage | dataLayer event | GA4 event | Meaning | Not proof of |
|---|---|---|---|---|
| Content | `MedicareContentView` | `medicare_content_view` | A registered selection or transaction page loaded | Engagement, contact, or lead acceptance |
| CTA | `MedicareCtaClick` | `medicare_cta_click` | A registered same-site CTA was clicked | Intake start or completed navigation |
| Intake | `StartLead` and `MedicareIntakeStart` | `medicare_intake_start` | First meaningful interaction with the Medicare intake | Valid submission or acceptance |
| Forms accepted | `Lead` | GTM emits the single `generate_lead` | `/api/lead` returned `ok: true`, `forms: true`, and an approved server event ID after Netlify Forms accepted the forward | Inbox, broker, or CRM delivery; qualified lead; completed review |
| Receipt | `LeadReceiptView` | `lead_receipt_view` | A fresh same-session accepted marker reached `/thanks.html` | A second lead or conversion |
| Downstream delivery | Not implemented | Not implemented | A receiving system confirms a readable work item | Nothing until an authenticated reconciliation source exists |

`medicare_lead_accepted` is a reporting stage, not a second browser conversion event. Report it by filtering the single `Lead`/`generate_lead` path to `content_cluster=lakeland_medicare_broker` and `acceptance_status=forms_accepted`. This preserves the established GTM trigger and prevents duplicate `generate_lead` events.

`medicare_delivery_confirmed`, `secure_intake_completed`, `case_ready_for_review`, and `review_completed` must remain unavailable until an authenticated downstream system can emit those outcomes. They must not be synthesized from a thank-you page, HTTP status, Forms count, or GA4 event.

## Safe Analytics Schema

### Content view

```json
{
  "schema_version": "medicare-attribution.v1",
  "event_id": "opaque-measurement-id",
  "page_key": "best_medicare_broker_lakeland_fl",
  "page_role": "selection",
  "content_cluster": "lakeland_medicare_broker",
  "intent": "medicare"
}
```

CTA events add one registry-approved `cta_key`. Intake events use `page_key=get_help`, `page_role=intake`, and may add the canonical `source_page_key`, `source_page_role`, and `source_cta_key` tuple.

An accepted Medicare `Lead` adds:

- the server-minted `event_id` shared by the `Lead` trigger, receipt marker, and server conversion deduplication;
- `acceptance_status=forms_accepted`;
- bounded `content_name`, `step`, and `page_type` tokens;
- the canonical Medicare source tuple when it survived server validation.

The measurement allowlist is positive and fail-closed. It excludes names, email, phone, ZIP, county, DOB/age, Medicare or policy identifiers, provider/facility names, prescription names, current-plan text, income, health or coverage answers, consent answers, notes, messages, free text, arbitrary query/referrer values, unknown keys, arrays, and objects.

The Get Help attribution record captures bounded, PII-filtered `utm_term` only from Google Ads ValueTrack `{keyword}` (the matched advertiser keyword, not the user's raw Search Terms query). It does not capture `gclid` or `fbclid`. `source_page` is a normalized path without a query string. `referral_page` is reduced to `direct`, `internal`, or `external` rather than retaining the referrer URL.

The lead endpoint separately enforces registered form-specific field allowlists, a 64 KB JSON-body limit, scalar-only values, and an 8 KB per-field limit. For Get Help, it requires request consent and server-authors the consent timestamp, evidence version, page, withdrawal state, and contact-channel states. Client-authored consent-state fields are overwritten. Meta CAPI, Ads/OpenAI CAPI, and Mailchimp do not run until Netlify Forms accepts the request.

## Acceptance and Deduplication Rules

The browser may emit `Lead` only when all conditions are true:

1. The HTTP response is successful.
2. The parsed response body has `ok: true`.
3. The parsed response body has `forms: true`.
4. `event_id` matches the approved opaque-ID format.

HTTP 4xx responses, Forms-forward failures, malformed HTTP 200 bodies, invalid JSON, missing event IDs, or rejected event IDs do not emit `Lead`, do not set the lead marker, and do not redirect as an accepted submission. A 5xx transport failure may use the existing native Netlify fallback, but that fallback remains unmeasured until acceptance can be proven.

The form submission guard permits one in-flight API request. The successful response produces one top-level `Lead`. GTM owns the only GA4 `generate_lead` and Google Ads conversion tags. The thank-you page consumes the marker and never emits another lead conversion.

## Scorecard

| Metric | Numerator | Denominator | Availability |
|---|---|---|---|
| Content views by role | `medicare_content_view` | Not applicable | After collection verification |
| Selection to transaction CTR | Selection-page clicks with `broker_help_nav` or `see_review_process` | Selection content views | After collection verification |
| Transaction to selection CTR | Transaction clicks with `selection_guide_nav` | Transaction content views | After collection verification |
| Medicare CTA rate | Registered Get Help CTA clicks | Content views for the same page key | After collection verification |
| CTA to intake-start rate | Sessions with `medicare_intake_start` after a registered CTA | Sessions with registered Get Help CTA click | After collection verification |
| Intake to Forms-accepted rate | Medicare-context `Lead` with `forms_accepted` | Medicare intake starts | After collection verification |
| Accepted to downstream-delivery rate | Authenticated downstream confirmations | Forms-accepted Medicare leads | **Unavailable** |
| Downstream to secure-intake completion | Authenticated completed secure intakes | Confirmed downstream deliveries | **Unavailable** |
| Secure intake to case-ready rate | Authenticated case-ready outcomes | Completed secure intakes | **Unavailable** |
| Case-ready to completed-review rate | Authenticated completed reviews | Case-ready outcomes | **Unavailable** |
| Search role separation | Query-by-page impressions/clicks assigned to the intended page role | Total cluster query-by-page impressions/clicks | Search Console export required |
| Shared-query percentage | Queries returned for both registered URLs | Unique queries returned for either registered URL | Search Console export required |

Use sessions for behavioral step rates unless an authenticated correlation key is introduced. Do not join people across systems using PII or analytics identifiers.

## 0/7/14/28-Day Review Schedule

### Day 0 — release baseline

- Record release commit, deploy ID, deployment timestamp, analytics asset version, and GTM version.
- Freeze the latest complete pre-release Search Console page, query, and query-by-page exports separately.
- Record GA4 content, CTA, intake, and accepted-lead counts as unavailable until production collection is verified; do not backfill zeros.
- Run synthetic preview QA and inspect the data layer/network payload for prohibited fields. Do not submit a real production lead without separate approval.

### Day 7 — instrumentation integrity

- Confirm each registered page emits one content view with correct page role.
- Confirm CTA and intake event names, allowed parameter cardinality, server event-ID continuity, and one `generate_lead` per synthetic accepted request.
- Reconcile synthetic `/api/lead` acceptance against the intended Forms/log evidence.
- Treat the seven-day sample as an instrumentation check, not a ranking or conversion conclusion.

### Day 14 — directional behavior and search split

- Report views, selection-to-transaction CTR, registered Get Help CTA rate, intake starts, Forms-accepted leads, and each denominator.
- Compare Search Console page and query-by-page results to the frozen baseline using equal-length complete-date windows.
- Calculate shared-query percentage without combining page rows, query rows, and query-by-page rows.
- Report downstream delivery and later outcomes as unavailable unless an authenticated source has been implemented and verified.

### Day 28 — decision window

- Repeat the full funnel and Search Console comparison with internal, preview, localhost, Tag Assistant, and synthetic traffic excluded.
- Review page-role separation, query overlap, CTR, intake completion, acceptance rate, errors, and sample size.
- Make content or URL decisions only with both search evidence and preserved visitor-task analysis. Attribution architecture alone does not justify a redirect.

## Reporting and Platform Gates

- Register event-scoped GA4 custom dimensions for `page_key`, `page_role`, `content_cluster`, `cta_key`, `source_page_key`, `source_page_role`, `source_cta_key`, and `acceptance_status` before relying on standard reports. Repository code does not prove those external definitions exist.
- Keep `medicare_content_view`, `medicare_cta_click`, `medicare_intake_start`, and `lead_receipt_view` as diagnostics. Keep the existing single `generate_lead` key event.
- Verify GTM and GA4 with DebugView/Tag Assistant after deployment. Local tests cannot prove a published GTM container, GA4 ingestion, Netlify delivery, or downstream receipt.
- Any downstream status writer must be authenticated, server-side, and limited to opaque event ID, normalized stage, and timestamp. Do not expose a public status-update endpoint.

## Verification

Run locally:

```bash
node --test tests/*.test.mjs
node scripts/validate-pages.mjs
node scripts/validate-authority.mjs
git diff --check
```

The automated tests cover exact page roles, deterministic CTA wiring, tamper rejection, the positive analytics allowlist, Medicare intake context, semantic Forms acceptance, server event-ID continuity, ACA non-regression, submit deduplication, and thank-you non-conversion. Production analytics, GTM behavior, and downstream delivery require separate live readback.
