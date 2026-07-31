# External Evidence and Consent Gates

Review date: July 31, 2026
Status: local specification; no external-account mutation or consumer-data export

## URL consolidation evidence

No redirect, retirement, deletion, or cross-canonical decision is authorized for the older Medicare, self-employed, job-loss, Florida-guide, city, or Local Answers URLs until the following aggregate evidence is available.

| Evidence source | Minimum safe fields | Decision use | Exclusions |
|---|---|---|---|
| Google Search Console | Landing-page URL, clicks, impressions, CTR, average position, country/device/date aggregates for 16 months | Detect distinct demand and protect ranking URLs | No account identifiers or query exports that expose a person |
| Backlink index | Target URL, referring domain, first/last seen, status, authority/spam indicator | Preserve externally linked URLs or build a deliberate redirect | No contact lists or outreach records |
| GA4 | Landing-page path, sessions, engaged sessions, aggregate conversion events, source/medium, date | Distinguish traffic and conversion roles | Exclude QA/internal traffic; no user IDs, form values, ZIP, income, provider, prescription, or free text |
| CRM/system of record | Aggregate lead count by normalized first landing URL and coverage category | Identify URLs that contribute to handled inquiries | No names, contact details, notes, policy, health, provider, prescription, or Medicare data |
| Netlify/function records | Aggregate successful delivery count and error count by form version and day | Validate delivery separately from analytics | No payload export, request identity, IP, user agent, or message text |

The decision record must list the compared URLs, evidence window, material differences in intent, backlinks, aggregate conversions, proposed destination, redirect type, affected internal links, sitemap change, validation result, and rollback target. A lack of traffic alone is not enough to redirect a page that owns a distinct user task.

## Consent and delivery evidence

The local Get Help implementation records requested contact, call, SMS, service email, marketing email, consent text version, timestamp, page/form, per-channel state, and initial withdrawal state. It does not prove downstream delivery or an ongoing withdrawal-state update.

Before a controlled production test:

1. David or designated legal/compliance owner approves the exact Privacy Policy, SMS Terms, consent language, retention period, and withdrawal workflow.
2. The receiving inbox/system and CRM test destination are identified without printing credentials.
3. The test uses an unmistakably synthetic identity and contains no provider, prescription, medical, policy, Medicare, income, or free-text detail.
4. The test separately records browser response, Netlify/function result, receiving-system receipt, CRM state, analytics event, and advertising suppression.
5. SMS STOP processing is verified in the downstream system and the system of record, not inferred from the website submission state.
6. The synthetic record is removed or retained according to the approved test-data policy.

No production lead or message was created during this work package. A thank-you page or analytics event remains explicitly insufficient evidence of delivery.

## Current decision state

- Consolidation: blocked pending aggregate Search Console, backlink, GA4, CRM, and delivery evidence.
- Consent copy: implemented locally with channel separation; final business/legal approval remains external.
- Withdrawal: initial state is recorded locally; downstream STOP and withdrawal-state propagation remain external.
- Production lead test: not performed because the required destination, synthetic identity, reconciliation access, and cleanup policy have not been approved as one controlled test packet.
- Google Business Profile and reviews: read-only evidence not supplied; no profile, rating, review-count, address, hours, or outreach change is authorized.
