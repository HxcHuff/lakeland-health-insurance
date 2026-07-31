# Florida Local Authority and Review Backlog

Prepared: July 30, 2026  
Status: specification only; no outreach, review request, profile change, publication, or external-account action was performed

## Review-request workflow specification

### Trigger

Send one neutral review request only after a completed, documented service milestone such as enrollment assistance, plan review, or resolved service request. Do not trigger from a quote alone, an unresolved complaint, a denied application, a carrier decision, or a person who did not authorize the selected communication channel.

### Suppression

- Suppress duplicate requests for at least 180 days.
- Suppress anyone who opted out of the selected channel.
- Suppress pending complaints, appeals, grievances, disputed enrollments, deceased contacts, and do-not-contact records.
- Do not use incentives, contests, premium gifts, selective positive-review routing, or suggested star ratings.
- Do not disclose coverage type, health status, subsidy, Medicare status, carrier, policy, provider, or prescription context.

### Neutral copy

> Thank you for working with David Huff at Lakeland Health Insurance. If you would like to share an honest review of your experience, you can use this business-profile link. A review is optional and does not affect your coverage or service. Please do not include policy, medical, Medicare, payment, or other private information.

### Audit fields

Record: request ID, client-system ID, service milestone, eligible channel, consent record ID, template version, send date/time, destination profile URL, sender, suppression checks, delivery result, opt-out result, and complaint/escalation flag. Do not place policy or medical details in the audit record.

### Approval gate

Before use, David must confirm the current public review destination, approve the template, approve the CRM suppression logic, and authorize a controlled test. No client contact is authorized by this repository work.

## External authority backlog

| Priority | Partner class | Evidence required before claim/link | Suggested non-promotional asset |
|---|---|---|---|
| 1 | Lakeland Chamber and local business organizations | Active membership/listing and exact public URL | Licensed-broker profile plus Florida coverage-path checklist |
| 1 | Florida DFS/NIPR public directories | Current producer/business listing | Verification links on About and Contact |
| 1 | CPAs, EAs, bookkeeping, and payroll firms | Written relationship scope; no implied tax advice or referral payment | Self-employed ACA income-document checklist with tax-professional boundary |
| 1 | HR consultants and benefits administrators | Written permission and audience fit | COBRA versus Marketplace transition worksheet |
| 2 | Independent pharmacies | Written participation and approved educational scope | Plan-ID, formulary, tier, restriction, and pharmacy verification card |
| 2 | Provider practices and local facilities | Written permission; no network-participation implication | Provider-location and plan-year verification checklist |
| 2 | Senior and caregiver organizations | Written education invitation; Medicare marketing review | Turning-65 and annual provider/Rx review checklist |
| 2 | Nonprofits and community assistance groups | Mission fit, approved resource link, no eligibility guarantee | Medicaid/CHIP loss-to-Marketplace pathway guide |
| 3 | Local media and libraries | Confirmed editorial/education placement | Source-dated Florida enrollment calendar and consumer checklist |
| 3 | Colleges, coworking groups, and entrepreneur networks | Confirmed audience and event permission | Freelancer/self-employed coverage decision framework |

Never publish a partnership, referral, membership, endorsement, provider relationship, or backlink claim until the evidence URL or written permission is stored in the approved business system.

## Ranked Florida content work

1. Create or materially refresh a “retiring before 65 in Florida” guide after source packet and review.
2. Expand the existing turning-65 guide to separate active-employer coverage, COBRA, retiree coverage, HSA, and Medicare timing.
3. Publish a focused Florida Medicaid/CHIP loss guide using current HealthCare.gov and Florida eligibility sources.
4. Refresh the projected-income guide with current reporting workflow, reconciliation limits, and tax-professional boundary.
5. Create a moving-into/out-of-Florida Medicare checklist after CMS and plan-service-area review.
6. Convert `/blog/florida-insurance-guide.html` into the state authority hub only after deciding its canonical role against existing Florida pages.
7. Review duplicate Medicare, self-employed, and job-loss URLs with Search Console/backlink data before any redirect.
8. Add a source-change monitor for CMS, Medicare.gov, HealthCare.gov, IRS, Florida DFS, and Florida OIR facts recorded in `data/regulated-claims.json`.

## City and county publication gate

Do not create another geography page until at least one of these exists:

- Search Console demand unique to the geography.
- Original, sourced local facility/network/plan-year evidence.
- A legitimate local organization or education relationship.
- A distinct county/rating-area workflow.
- A documented local enrollment-assistance detail that cannot be served by the Lakeland/Polk canonical pages.

Each new local page must pass the same source, entity, consent, analytics, accessibility, and claim validators as the priority pages. Location-name substitution is not sufficient.
