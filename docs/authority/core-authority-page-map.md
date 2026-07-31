# Core Authority Page Map — Work Package 02

Review date: July 31, 2026
Repository baseline: `2d3722692b7c4f71dd0cf3ea29f74864ac7f7da6`
Evidence posture: local source and read-only production/deploy readback; no form submission or external-account mutation

## Evidence boundaries

- **Current fact** means directly read from the checked-out source, Git, the verified Netlify release mapping, or the production response on July 31, 2026.
- **Recommendation** is a reversible information-architecture decision for a later package.
- Search Console queries/clicks, backlink value, GA4 conversions, CRM outcomes, and lead-delivery evidence were not directly read back for URL decisions in this work package. They are **unavailable**, not zero.
- No redirect, retirement, deletion, canonical change, or material intent change is authorized without that evidence and David's approval.

## Canonical core pages

All pages below are indexable, use their existing self-referencing canonical, retain one H1, preserve the analytics/site-template loaders applicable to their template, and route through existing phone, form, or state/product controls.

| URL | Current visitor intent and scope | Current title / H1 | Primary next action | Schema and review evidence | Internal links out / in | Disposition | Priority and risk |
|---|---|---|---|---|---:|---|---|
| `/aca-health-insurance-lakeland-fl/` | 2027 ACA decision support; Lakeland, Polk County, Florida | `ACA Health Insurance Help in Lakeland, FL \| 2027 Enrollment` / eligibility, income, network, enrollment window | Start an ACA review | `WebPage`, `Service`, visible FAQ; canonical website/agency/David refs; CMS/IRS sources; reviewed 2026-07-30 | 10 / 64 | Expand in place | P1 annual source freshness; no subsidy, premium, eligibility, network, or plan guarantee |
| `/medicare/` | Canonical 2027 Medicare review; Lakeland and Polk County | `Medicare Help in Lakeland, FL \| 2027 Plan Review` / exact plan around care | Start a Medicare review | `WebPage`, `Service`, visible FAQ; canonical refs; Medicare.gov/CMS sources; reviewed 2026-07-30 | 6 / 99 | Expand in place | P1 legacy Medicare URLs overlap broker intent; no plan-specific availability claim |
| `/self-employed-health-insurance/` | Florida projected-income and coverage-path guide | `Self-Employed Health Insurance in Florida \| ACA Guide` / projected household income | Start a self-employed review | `Article`, `Service`; canonical refs; primary sources; reviewed 2026-07-30 | 9 / 3 | Expand in place | P1 low inbound depth; Marketplace makes final tax-credit/eligibility determination |
| `/losing-coverage/` | Florida COBRA/Marketplace/SEP comparison | `COBRA vs Marketplace After Losing Coverage in Florida` / deadline, effective date, network, cost | Start a coverage-loss review | `Article`, `Service`; canonical refs; HealthCare.gov/DOL sources; reviewed 2026-07-30 | 5 / 4 | Expand in place | P1 low inbound depth; no SEP or effective-date determination |
| `/provider-prescription-check/` | Privacy-safe Florida verification workflow | `Verify Florida Providers & Prescriptions by Plan ID and Year` / exact provider, location, plan ID, year | Request verification steps | `Article`, `Service`; canonical refs; primary sources; reviewed 2026-07-30 | 7 / 10 | Expand in place | P1 human-reviewed only; no automated or guaranteed network/formulary result |
| `/get-help/` | First-party structured intake; Florida | `Get Health Insurance Help in Lakeland, FL \| David Huff` / correct next step without long intake | Complete staged form or call | `WebPage`, `Service`, breadcrumb; canonical refs; channel-specific versioned consent | 8 / 918 | Tighten, keep role | P1 final business/legal consent approval and downstream STOP-state verification remain external; form not submitted in QA |
| `/plans/` | Education and coverage-path selection; Florida | `Florida Health Insurance Paths \| ACA, Medicare & More` / choose path before products | Continue to Florida router | `WebPage`, `Service`; canonical refs; fixed-indemnity disclosure and source | 12 / 376 | Keep distinct; consolidate copy later | P2 do not infer inventory, price, carrier, benefit, or availability |
| `/quote/` | Browser-local ZIP/product router; Florida with official fallback | `Florida Health Insurance Quote & Enrollment Router` / confirm ZIP and type | In-page route after state/product gate | `WebPage`, `Service`; canonical refs; reviewed 2026-07-30 | 4 / 229 | Keep distinct | P1 router is not a licensure, appointment, eligibility, or availability determination |
| `/contact/` | Privacy-safe direct contact; Lakeland/Florida | `Contact David Huff \| Lakeland Health Insurance` / contact David | Consent-controlled Get Help route | `ContactPage`, `ContactPoint`; canonical refs; privacy warning | 9 / 463 | Tighten, keep role | No current P0/P1 code defect; do not solicit sensitive details by email or URL |

## Legacy and overlapping authority surfaces

| URL | Current intent and state | Work Package 02 action | Links out / in | Disposition | Evidence required before URL action |
|---|---|---|---:|---|---|
| `/local-health-insurance-answers/` | Lakeland/Polk direct-answer directory | Added stable entity refs, reviewer/date, non-carrier/availability boundary, and contextual Learning/Plans links | 11 / 1 | Retire from expansion; preserve URL | Search Console queries/clicks, backlinks, assisted conversions, internal-link value |
| `/local-health-insurance-answers/health-insurance-broker-lakeland-fl/` | Local broker answer | Replaced decorative FAQ schema with `WebPage` refs; added review/availability boundaries and links to canonical ACA, Medicare, and verification pages | 8 / 2 | Tighten; preserve URL | Same evidence plus lead/phone attribution |
| `/medicare-broker-lakeland-fl/` | Seasonal Lakeland Medicare broker landing | Updated 2027 framing; removed address, Offer, price/free, repeated agency, and unsupported network schema/copy; added canonical refs and Medicare.gov source | 19 / 26 | Consolidate later; preserve URL | Query/click split versus `/medicare/`, backlinks, conversions, seasonal assisted value |
| `/best-medicare-broker-lakeland-fl/` | Neutral broker-selection checklist serving a legacy query | Removed address, price, founder/Person, repeated agency, and FAQ schema; qualified compensation and ranking language; added canonical refs/source/date | 15 / 24 | Consolidate later; preserve URL | Query intent, backlinks, conversions, and proof that a redirect would not destroy selection-framework value |
| `/our-approach.html` | Review methodology | Replaced full agency object with canonical refs; removed unverified headquarters/hours; added review date and limitations | 15 / 43 | Keep | No redirect indicated; test density/engagement later |
| `/learning/` | Evergreen task-based education and official resources | Replaced duplicate Person/Organization with canonical refs; updated review date; removed unverified headquarters/hours | 28 / 287 | Keep as evergreen hub | Taxonomy/engagement evidence for later content migration only |
| `/blog/` | Dated Florida updates and article discovery | Removed nationwide framing and decorative FAQ; normalized entity refs; stated Blog versus Learning role; added review boundary | 95 / 767 | Keep as chronological hub | Article-level performance evidence for later pruning; no index redirect |

## Overlap inventory outside the reviewed page bodies

Current repository URLs with material intent overlap include:

- Self-employed: `/blog/health-insurance-self-employed-lakeland-polk-county-2026.html`, `/blog/freelancer-health-insurance-lakeland-2026.html`, `/blog/health-insurance-self-employed-tax-deductions.html`, `/blog/self-employed-tax-deductions-ichra-guide.html`, and `/local-health-insurance-answers/self-employed-health-insurance-polk-county/`.
- Job loss/SEP: `/blog/lost-job-coverage-aca-insurance-florida.html`, `/blog/lost-job-health-insurance-lakeland.html`, `/blog/life-change-health-insurance-60-day-window-florida.html`, and `/local-health-insurance-answers/employee-losing-group-coverage/`.
- Medicare broker/transition: `/medicare-broker-lakeland-fl/`, `/best-medicare-broker-lakeland-fl/`, `/local-health-insurance-answers/medicare-plan-help-lakeland/`, `/blog/turning-65-medicare-checklist-florida.html`, `/blog/when-can-i-switch-medicare-plans-florida.html`, and `/lp/medicare/`.
- Florida guides: `/blog/florida-insurance-guide.html`, `/blog/florida-aca-enrollment-and-benefits-2026.html`, and dated city/market articles under `/blog/`.

Recommendation: preserve all URLs now. In a later evidence package, choose one canonical intent owner per cluster, refresh differentiated articles, and redirect only when Search Console, backlink, analytics, CRM, and conversion evidence supports the irreversible change.

## Authority hierarchy implemented

Home remains the primary authority node. Existing contextual paths now reinforce ACA, Medicare, self-employed, loss-of-coverage, provider/prescription verification, Plans, Quote, Learning, About, and Get Help without changing primary navigation. Blog is explicitly chronological/current; Learning is explicitly evergreen/task-based. No city, county, state, or programmatic page was created.
