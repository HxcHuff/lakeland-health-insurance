# Mailchimp newsletter sync

Website newsletter and consented lead forms sync to David Huff's Mailchimp
audience after Netlify Forms accepts the submission. HubSpot portal
`247504188` and the notification email to
`david@lakelandhealthinsurance.com` are unchanged and continue to fire from
the existing Forms / CRM path. Mailchimp is fail-open: a Mailchimp error or
3-second timeout never changes the browser response.

## Environment variables

Configure these on the Netlify production Functions context. Do not put the
API key in source control, tickets, preview/branch contexts, or logs.

| Name | Purpose |
| --- | --- |
| `MAILCHIMP_API_KEY` | Runtime-only Mailchimp API key. If unset, Mailchimp is skipped and a one-line warning is logged. |
| `MAILCHIMP_AUDIENCE_ID` | Audience / list id. Production value: `cd34641e14`. |
| `MAILCHIMP_DC` | Data-center prefix. Production value: `us17` (API base `https://us17.api.mailchimp.com/3.0`). |

`MAILCHIMP_SERVER_PREFIX` remains a fallback for `MAILCHIMP_DC` so an older
name still resolves. Prefer `MAILCHIMP_DC`.

A sanitized template lives in [`.env.example`](../.env.example).

## Consent

- Newsletter forms (`homepage-newsletter`, `newsletter-signup`) are the
  marketing opt-in. New members are created with `status_if_new: pending`
  (double opt-in).
- Sales / service forms sync only when `consent_marketing_email=yes`. The
  checkbox is optional and unchecked by default. No check means no
  Mailchimp call.
- Existing `subscribed` or `pending` members are not downgraded.
- `unsubscribed`, `cleaned`, and `archived` members are left untouched.

## Merge fields and tags

Mailchimp receives email plus `FNAME` / `LNAME` when the form collected a
name. Phone, date of birth, ZIP, health details, and other fields are not
sent.

Form-source tags, when they fit existing audience tags:

| Form | Tags |
| --- | --- |
| `homepage-newsletter` | `homepage`, `newsletter` |
| `newsletter-signup` | `newsletter`, `newsletter-page` |
| `get-help` (canonical and sitelink) | `get-help`, `lead` |
| Other allowlisted lead forms | `lead` |

Coverage-interest tags are added only when the form asks for a coverage
topic and the value maps to an existing tag:

| Normalized form value | Tag |
| --- | --- |
| `medicare` | `Medicare` |
| `under 65` | `Under 65` |
| `individual and family coverage`, `aca`, `aca marketplace`, `marketplace aca`, `individual marketplace`, `family marketplace` | `individual-and-family-coverage` |
| `life` | `Life` |

Unmapped values receive no coverage tag. New tags are not invented.

## Go-live

1. Set `MAILCHIMP_API_KEY`, `MAILCHIMP_AUDIENCE_ID`, and `MAILCHIMP_DC` in
   the Netlify production Functions environment. Do not change other
   Netlify or Vercel deploy settings for this work.
2. Confirm the welcome-series automation starts when the subscriber
   completes the Mailchimp double-opt-in confirmation, not at the pending
   upsert.
