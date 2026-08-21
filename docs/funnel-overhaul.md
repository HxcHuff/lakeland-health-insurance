# Lakeland Funnel Overhaul

Updated: 2026-07-26

Measurement addendum: 2026-08-14. The Medicare attribution contract below supersedes earlier measurement-boundary language; the original rollout baseline remains historical.

## Baseline

- Repository state before edits: `main...origin/main`, clean worktree.
- Validation before edits:
  - `node scripts/validate-pages.mjs` -> `OK - validated 136 HTML files`
  - `node --test tests/funnel.test.mjs` -> 22 passed
  - `git diff --check` -> passed
- The production site remains static HTML plus Netlify Functions. Its root `package.json` is limited to pinned Function runtime dependencies and does not introduce a site build pipeline.

## Funnel Map

| Route | Purpose | Primary CTA |
|---|---|---|
| `/best-medicare-broker-lakeland-fl/` | Medicare broker-selection methodology | Registered links to the transaction page and `/get-help/?intent=medicare...` |
| `/medicare-broker-lakeland-fl/` | Transactional Medicare review page | Registered links to the selection page and `/get-help/?intent=medicare...` |
| `/get-help/` | Progressive intake for all supported intents | Submit through `/api/lead` |
| `/losing-coverage/` | COBRA, job loss, Medicaid, spousal, or employer coverage loss | `/get-help/?intent=lost-coverage` |
| `/turning-26/` | Age-off parent-plan review | `/get-help/?intent=turning-26` |
| `/self-employed-health-insurance/` | Owner, contractor, freelancer, gig-worker review | `/get-help/?intent=self-employed` |
| `/current-client-review/` | Existing-client annual review and service request | `/get-help/?intent=current-client-review` |
| `/provider-prescription-check/` | Provider, facility, or prescription review | `/get-help/?intent=provider-check` and `prescription-check` |
| `/employer-referral/` | Employer, HR, payroll, CPA, PEO, attorney, or BNI handoff | `/get-help/?intent=employer-referral` |
| `/post-enrollment-review/` | Recent-enrollment service request | `/get-help/?intent=post-enrollment-review` |
| `/thanks.html` | Same-session confirmation and next steps | No direct conversion on refresh or direct visit |

## Intent Definitions

Allowed `intent` values:

- `aca`
- `medicare`
- `lost-coverage`
- `turning-26`
- `self-employed`
- `current-client-review`
- `provider-check`
- `prescription-check`
- `coverage-gap`
- `employer-referral`
- `post-enrollment-review`

Unknown values fall back to `not-sure`. Query-string values are never injected into HTML; the page renders from the allowlisted config in `/js/get-help-intake.js`.

## Form Names And Content Names

| Form | Event | Content Name |
|---|---|---|
| `get-help` | `Lead` | Intent-specific: `get_help_aca`, `get_help_medicare`, `get_help_lost_coverage`, `get_help_turning_26`, `get_help_self_employed`, `get_help_current_client_review`, `get_help_provider_check`, `get_help_prescription_check`, `get_help_coverage_gap`, `get_help_employer_referral`, `get_help_post_enrollment_review`, or `get_help_default` |
| `newsletter-signup` | `Subscriber` | `newsletter_optin` |
| `homepage-newsletter` | `Subscriber` when converted to the canonical event | Existing form name retained |
| `subsidy-estimator-lead` | `Lead` | `subsidy_estimator_lead_form` |
| `lp-aca-lead` | `Lead` | `lp_aca_lead_form` |
| `lp-medicare-lead` | `Lead` | `lp_medicare_lead_form` |
| `lp-gap-lead` | `Lead` | `lp_gap_lead_form` |

## Event Dictionary

| Event | Trigger | Required Properties | Prohibited Properties | Destinations | Deduplication |
|---|---|---|---|---|---|
| `PageView` | Funnel bus page load | `page_type` | PII, provider names, prescription names | dataLayer | One per page script load |
| `MedicareContentView` / `medicare_content_view` | Registered selection or transaction page loads | `schema_version`, `event_id`, `page_key`, `page_role`, `content_cluster`, `intent` | URL/query/referrer, PII, form answers | dataLayer and direct GA4 diagnostic event | One per analytics script load |
| `MedicareCtaClick` / `medicare_cta_click` | Registered same-site Medicare CTA click | Content-view fields plus registered `cta_key` | Link text, arbitrary destination, PII, form answers | dataLayer and direct GA4 diagnostic event | One event per click with a fresh event ID |
| `ViewContent` | Future content milestones | `content_name`, `page_type` | PII, sensitive answers | dataLayer | Stable event id |
| `StartLead` | First meaningful form engagement | `content_name`, `step` | PII, provider names, prescription names | dataLayer | Per-form in-memory guard |
| `MedicareIntakeStart` / `medicare_intake_start` | First meaningful interaction on allowlisted Medicare Get Help intake | `schema_version`, `page_key=get_help`, `page_role=intake`, source tuple when valid, `content_cluster`, `intent`, `step` | Raw query/referrer, PII, form answers | dataLayer and direct GA4 diagnostic event | Per-form in-memory guard |
| `Lead` | Browser verifies `/api/lead` returned `ok: true`, `forms: true`, and an approved server `event_id` | `content_name`, `event_id`, `acceptance_status=forms_accepted`; canonical Medicare context when present | Raw names, email, phone, ZIP, policy/Medicare IDs, providers, prescriptions, income, health/coverage answers, free text | dataLayer; GTM owns GA4 `generate_lead` and Google Ads; server owns CAPI | One accepted response, one server event ID, one thank-you marker |
| `LeadReceiptView` | Fresh same-session lead reaches `/thanks.html` | `content_name`, `step` | PII, form answers | dataLayer, GA4 diagnostic event `lead_receipt_view` | Fresh lead marker consumed once; direct visits do not fire |
| `Subscriber` | `/api/lead` success for newsletter forms | `content_name`, `event_id` | Raw names, email, phone | dataLayer, Mailchimp only | `event_id`, same-session marker consumed once |
| `Schedule` | Calendly link click | `content_name` | PII | dataLayer | Click event id |
| `PhoneCallClick` | Canonical future phone event | Link label only | Phone/email/name answers | dataLayer | Click event id |
| `ExternalQuoteClick` | HealthSherpa or quote engine click | `content_name`, destination class | PII | dataLayer | Click event id |
| `QualifiedLead` | Server-side/admin outcome update | `lead_id`, `stage` | PHI, commission, private notes | Future server/offline conversion workflow | Stable lead id |
| `AppointmentCompleted` | Server-side/admin outcome update | `lead_id`, `stage` | PHI, commission, private notes | Future server/offline conversion workflow | Stable lead id |
| `ApplicationStarted` | Server-side/admin outcome update | `lead_id`, `stage` | PHI, commission, private notes | Future server/offline conversion workflow | Stable lead id |
| `Enrollment` | Server-side/admin outcome update | `lead_id`, `stage` | PHI, commission, private notes | Future server/offline conversion workflow | Stable lead id |

Legacy `phone_call_click`, `phone_call`, and `generate_lead` are preserved for existing reporting. `Subscribe` is replaced by `Subscriber` for newsletter signup. `generate_lead` means Forms acceptance, not confirmed readable downstream delivery.

## Form To API To Mailchimp Mapping

| Submission | API Behavior | Meta CAPI | Google Ads Lead | Mailchimp |
|---|---|---|---|---|
| Sales/service lead | POST `/api/lead`; server canonicalizes attribution; Netlify Forms acceptance gates the success response | Production only after Forms acceptance | Browser `Lead` only after semantic acceptance | `pending` only when separately authorized marketing consent is present |
| Current client review | Same acceptance boundary, tagged as service request | Production only after Forms acceptance | Browser `Lead` only after semantic acceptance unless later split in ad UI | `pending` only with separate marketing consent; service tags retained |
| Post-enrollment review | Same acceptance boundary, tagged as service request | Production only after Forms acceptance | Browser `Lead` only after semantic acceptance unless later split in ad UI | `pending` only with separate marketing consent; service tags retained |
| Newsletter | POST `/api/lead`, forward to Netlify Forms, return accepted server event ID | Skipped | Skipped | `pending` confirmed opt-in |
| Google-hosted Ads lead | Google webhook authenticates, validates, and atomically records one privacy-safe receipt before internal notification attempts | Not applicable | Recorded by Google Ads at the hosted form | Always skipped without exact, durably stored marketing-email consent |

## Thank-You Behavior

- `/thanks.html` reads `sessionStorage.lhi_submission_completed` or the legacy `lhi_lead_submitted`.
- The marker is removed immediately.
- The canonical `Lead` conversion fires only after `/api/lead` reports Netlify Forms acceptance, not on the thank-you page.
- A fresh same-session lead arrival records the diagnostic `lead_receipt_view` event without firing another conversion.
- Newsletter confirmation uses `Subscriber` language and never fires `Lead`.
- Direct visits and refreshes use the generic fallback and do not create conversions.

## Attribution Fields

The Get Help flow preserves:

- normalized `source_page` path without its query string
- `referral_page` classification (`direct`, `internal`, or `external`), not the referrer URL
- `source_page_key`
- registry-derived `source_page_role`
- `source_cta_key`
- registry-derived `content_cluster`
- server-minted `event_id`
- server timestamps used for the accepted submission record
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `product_interest`
- `plan_interest`
- `normalized_intent`
- `line_of_business`

Medicare source URLs contain only `intent=medicare`, an allowlisted page key, an allowlisted CTA key, and validated campaign values. Contact-like values are rejected. The Get Help attribution record may copy bounded `utm_term` from Google Ads ValueTrack `{keyword}` (the matched advertiser keyword, not the user's raw Search Terms query); it does not copy `gclid`, `fbclid`, a full referrer URL, or the arbitrary query string.

The analytics field allowlist excludes raw name, email, phone, ZIP, DOB/age, Medicare and policy identifiers, provider/facility names, prescription names, income, health or coverage answers, notes, messages, free text, unknown fields, arrays, and objects. Exact registry values are derived rather than trusted from query or hidden fields.

The API applies a separate form-storage boundary: registered form-specific field allowlists, a 64 KB body cap, scalar-only values, and an 8 KB per-field cap. Get Help requires request consent and overwrites consent evidence with server-derived timestamps, version, page, withdrawal state, and channel states. Meta CAPI, Ads/OpenAI CAPI, and Mailchimp run only after Forms acceptance.

The Google-hosted lead path is separate from `/api/lead`. Its webhook has a 64 KB body cap, bounded scalar fields, shared-key authentication, and an atomic site-scoped receipt keyed by a domain-separated SHA-256 digest of Google `lead_id`. Receipt identity is independent of the rotatable authentication key. The receipt stores no contact data, click ID, form answer, or raw Ads identifier. Duplicate deliveries return 200 without another notification attempt; receipt-store failure returns 503 before downstream work. Email/SMS are at-most-once operational notifications, and Mailchimp fails closed because the hosted form does not collect separate verified marketing-email consent.

## Measurement Boundaries

- `medicare_content_view`, `medicare_cta_click`, and `medicare_intake_start` are behavioral diagnostics.
- `Lead` and GTM's `generate_lead` mean the Netlify Forms forward was accepted.
- `lead_receipt_view` means a fresh same-session accepted marker reached the confirmation page; it is not another conversion.
- Downstream readable delivery to the broker, inbox, or CRM is not yet measured. Neither an HTTP 200, Forms acceptance, GA4 event, nor thank-you view proves that downstream delivery.
- Secure-intake completion, case-ready status, and completed human review remain future authenticated outcome stages.

The Medicare page/CTA registry, safe event schemas, and 0/7/14/28-day scorecard are maintained in `docs/medicare-attribution-measurement.md`.

## Outcome Stages

Supported normalized future stages:

- `Lead`
- `QualifiedLead`
- `AppointmentScheduled`
- `AppointmentCompleted`
- `ApplicationStarted`
- `Enrollment`
- `NotQualified`
- `UnableToContact`
- `ExistingClientService`

## Outcome Attribution Spec

The repository currently has a public `/api/lead` function but no authenticated admin identity layer. A status-update endpoint should not be exposed until server-side authorization exists.

`lead_priority` is an automatic routing aid, not a human qualification decision. It must never trigger `qualify_lead`.

Recommended schema:

```sql
create table lead_outcomes (
  id uuid primary key default gen_random_uuid(),
  lead_event_id text not null,
  normalized_stage text not null check (normalized_stage in (
    'Lead',
    'QualifiedLead',
    'AppointmentScheduled',
    'AppointmentCompleted',
    'ApplicationStarted',
    'Enrollment',
    'NotQualified',
    'UnableToContact',
    'ExistingClientService'
  )),
  normalized_intent text,
  line_of_business text,
  source_page text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
```

API contract for future protected workflow:

- `POST /.netlify/functions/lead-outcome`
- Required auth: server-verified admin token or Netlify Identity role, never a client-side secret.
- Request body: `{ "lead_event_id": "...", "normalized_stage": "QualifiedLead", "occurred_at": "...optional ISO timestamp..." }`
- Do not accept raw client details, commission, medical details, prescription details, provider notes, or freeform private notes.
- Response: `{ "ok": true, "outcome_id": "..." }`
- Add durable source, outcome, idempotency, and delivery-outbox records before exposing the endpoint. A webhook or notification alone is not a lifecycle ledger.
- Website GA4 outcomes require the authentic original GA4 `client_id`; the repository does not currently capture it. Never synthesize a GA4 user or trust a client ID supplied by the outcome request.
- Google-hosted form and ad-call outcomes belong in Google Ads offline outcome reporting using their protected Ads identifiers; they must not be converted into fabricated GA4 users.
- Keep a future qualified-lead conversion action secondary until it reconciles one-for-one with authenticated CRM outcomes.

## Privacy Restrictions

- Do not send raw names, emails, phone numbers, provider names, prescription names, or notes to GA4, Google Ads event parameters, Meta event parameters, URLs, or dataLayer.
- Identity-based Google Ads enhanced conversions are not implemented or authorized in this repository. Do not add raw or hashed contact data to Google tracking without separate privacy, consent, and release approval.
- Employer referrals must not collect employee medical information from the employer.
- Provider and prescription details are form payload data for David's review, not advertising payload properties.

## Testing Instructions

Run:

```bash
node scripts/validate-pages.mjs
node --test tests/funnel.test.mjs
git diff --check
```

Manual browser checks:

- `/get-help/`
- `/get-help/?intent=aca`
- `/get-help/?intent=medicare`
- `/get-help/?intent=lost-coverage`
- `/get-help/?intent=turning-26`
- `/get-help/?intent=self-employed`
- `/get-help/?intent=current-client-review`
- `/get-help/?intent=provider-check`
- `/get-help/?intent=prescription-check`
- `/get-help/?intent=coverage-gap`
- `/get-help/?intent=employer-referral`
- `/get-help/?intent=post-enrollment-review`
- `/thanks.html`
- All seven specialized funnel pages

Do not submit real production leads during testing.

## Deployment And Rollback

- Review the branch before merge.
- Do not deploy production until tests pass and David approves the release.
- Rollback is a normal Git revert of the funnel-overhaul commit if needed.
- After release, verify Netlify production deploy commit, cache-busted source for changed pages, and desktop/mobile browser rendering separately.

## Known Limitations

- There is no authenticated CRM/admin status workflow in this repo yet; outcome attribution is documented as a secure spec, not an insecure public endpoint.
- Calendly appointment-completed tracking depends on Calendly event availability and is not implemented as a completed appointment signal here.
- Some legacy pages still contain page-local submit listeners. The global funnel bus now handles canonical API delivery for `data-funnel-track` forms; remaining local listeners should be removed only after page-by-page testing.

## Recommended Conversion Configuration

- GA4 key events: `Lead`, `Subscriber`, `Schedule`, `PhoneCallClick`, `ExternalQuoteClick`, `QualifiedLead`, `ApplicationStarted`, `Enrollment`.
- Google Ads primary conversion: Forms-accepted `Lead` only after semantic `/api/lead` success. Treat `Subscriber`, phone clicks, schedule clicks, and external quote clicks separately.
- Meta standard event: server-side `Lead` only for non-newsletter lead forms. Do not send `Lead` for newsletter subscribers.
