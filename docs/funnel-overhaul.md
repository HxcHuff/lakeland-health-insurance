# Lakeland Funnel Overhaul

Updated: 2026-07-26

## Baseline

- Repository state before edits: `main...origin/main`, clean worktree.
- Validation before edits:
  - `node scripts/validate-pages.mjs` -> `OK - validated 136 HTML files`
  - `node --test tests/funnel.test.mjs` -> 22 passed
  - `git diff --check` -> passed
- Root checkout has no root `package.json`; this production repo is static HTML plus Netlify Functions.

## Funnel Map

| Route | Purpose | Primary CTA |
|---|---|---|
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
| `ViewContent` | Future content milestones | `content_name`, `page_type` | PII, sensitive answers | dataLayer | Stable event id |
| `StartLead` | First meaningful form engagement | `content_name`, `step` | PII, provider names, prescription names | dataLayer | Per-form in-memory guard |
| `Lead` | `/api/lead` success for sales/service lead forms | `content_name`, `event_id`, `normalized_intent`, `line_of_business` | Raw names, email, phone, provider names, prescription names | dataLayer, Google Ads enhanced conversion, Meta CAPI from server | `event_id`, thank-you marker consumed once |
| `LeadReceiptView` | Fresh same-session lead reaches `/thanks.html` | `content_name`, `step` | PII, form answers | dataLayer, GA4 diagnostic event `lead_receipt_view` | Fresh lead marker consumed once; direct visits do not fire |
| `Subscriber` | `/api/lead` success for newsletter forms | `content_name`, `event_id` | Raw names, email, phone | dataLayer, Mailchimp only | `event_id`, same-session marker consumed once |
| `Schedule` | Calendly link click | `content_name` | PII | dataLayer | Click event id |
| `PhoneCallClick` | Canonical future phone event | Link label only | Phone/email/name answers | dataLayer | Click event id |
| `ExternalQuoteClick` | HealthSherpa or quote engine click | `content_name`, destination class | PII | dataLayer | Click event id |
| `QualifiedLead` | Server-side/admin outcome update | `lead_id`, `stage` | PHI, commission, private notes | Future server/offline conversion workflow | Stable lead id |
| `AppointmentCompleted` | Server-side/admin outcome update | `lead_id`, `stage` | PHI, commission, private notes | Future server/offline conversion workflow | Stable lead id |
| `ApplicationStarted` | Server-side/admin outcome update | `lead_id`, `stage` | PHI, commission, private notes | Future server/offline conversion workflow | Stable lead id |
| `Enrollment` | Server-side/admin outcome update | `lead_id`, `stage` | PHI, commission, private notes | Future server/offline conversion workflow | Stable lead id |

Legacy `phone_call_click`, `phone_call`, and `generate_lead` are preserved for existing reporting. `Subscribe` is replaced by `Subscriber` for newsletter signup.

## Form To API To Mailchimp Mapping

| Submission | API Behavior | Meta CAPI | Google Ads Lead | Mailchimp |
|---|---|---|---|---|
| Sales/service lead | POST `/api/lead`, forward to Netlify Forms, return `event_id` | Production only | Browser `Lead` only after API success | `subscribed`, form tags plus intent tags |
| Current client review | Same as lead, tagged as service request | Production only | Browser `Lead` only after API success unless later split in ad UI | `subscribed`, `existing-client-service`, `service-request` |
| Post-enrollment review | Same as lead, tagged as service request | Production only | Browser `Lead` only after API success unless later split in ad UI | `subscribed`, `existing-client-service`, `service-request` |
| Newsletter | POST `/api/lead`, forward to Netlify Forms, return `event_id` | Skipped | Skipped | `pending`, newsletter tags |

## Thank-You Behavior

- `/thanks.html` reads `sessionStorage.lhi_submission_completed` or the legacy `lhi_lead_submitted`.
- The marker is removed immediately.
- The canonical `Lead` conversion fires at the successful `/api/lead` delivery boundary, not on the thank-you page.
- A fresh same-session lead arrival records the diagnostic `lead_receipt_view` event without firing another conversion.
- Newsletter confirmation uses `Subscriber` language and never fires `Lead`.
- Direct visits and refreshes use the generic fallback and do not create conversions.

## Attribution Fields

The Get Help flow preserves:

- `source_page`
- `referral_page`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `gclid`
- `fbclid`
- `product_interest`
- `plan_interest`
- `normalized_intent`
- `line_of_business`

PII is not placed in URLs. The funnel event bus does not send raw name, email, phone, provider names, prescription names, or notes to analytics payloads.

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
- Offline conversion compatibility: keep `lead_event_id`, `gclid` where already captured in the original lead, stage timestamp, and normalized stage mapping.

## Privacy Restrictions

- Do not send raw names, emails, phone numbers, provider names, prescription names, or notes to GA4, Google Ads event parameters, Meta event parameters, URLs, or dataLayer.
- Enhanced conversions may use raw contact data only locally in the browser long enough to hash it for Google, and server-side Meta CAPI hashes contact data before sending.
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
- Google Ads primary conversion: confirmed `Lead` only after `/api/lead` success. Treat `Subscriber`, phone clicks, schedule clicks, and external quote clicks separately.
- Meta standard event: server-side `Lead` only for non-newsletter lead forms. Do not send `Lead` for newsletter subscribers.
