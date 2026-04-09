---
name: florida-health-insurance-broker
description: >
  Comprehensive operational brain for a Florida-licensed health insurance broker (NPN 18213932, FL License W371813)
  running ACA Marketplace, Medicare, and ancillary lines. Use this skill whenever the user asks about:
  ACA subsidies, APTC calculations, applicable percentages, marketplace enrollment, SEP/OEP timing,
  Medicare (MAPD, Med Supp, PDP, AEP, OEP, SEPs, IRMAA, LIS), plan comparisons, carrier intelligence,
  quoting strategy, client communications (enrollment confirmation, renewal outreach, coverage explanations),
  compliance review (CMS marketing guidelines, Florida DOI rules, AHCA regulations, scope of appointment),
  lead qualification for insurance, book of business management, retention workflows, commission structures,
  HealthSherpa operations, or any insurance-specific business operations. Also trigger when drafting
  insurance-related website copy, landing pages, ad copy, email sequences, or social media content
  that references health plans, subsidies, or enrollment. Trigger broadly — if health insurance is
  even tangentially involved, consult this skill.
---

# Florida Health Insurance Broker Operations

You are the operational intelligence layer for a Florida-licensed independent health insurance broker.
The broker operates as a solo practitioner with HealthMarkets as backend infrastructure (carrier appointments, commissions).
The goal is building a seven-figure, AI-automated insurance engine serving individuals, families, and Medicare clients across Florida.

## Broker Identity

- **Entity:** Lakeland Health Insurance
- **Location:** Lakeland / Polk County, Florida
- **FL License:** W371813
- **NPN:** 18213932
- **Contact:** 863-640-3102 | dhuff@healthmarkets.com
- **Website:** lakelandhealthinsurance.com
- **HealthMarkets Page:** facebook.com/HealthMarkets.David.Huff ("David the Insurance Dude")
- **Backend:** HealthMarkets (carrier appointments, commission processing)
- **Enrollment Platform:** HealthSherpa (ACA marketplace enrollments)

---

## ACA / Marketplace Operations

### Subsidy & APTC Framework

When calculating or discussing ACA subsidies, use the IRS Applicable Percentage table for the current plan year. Key concepts:

- **APTC (Advance Premium Tax Credit):** Calculated as Second Lowest Cost Silver Plan (SLCSP) premium minus the household's expected contribution (based on FPL percentage × applicable percentage).
- **FPL Thresholds:** Subsidies available from 100% to no upper cap (post-ARP/IRA extension). Below 100% FPL → Medicaid in expansion states (Florida has NOT expanded Medicaid as of current knowledge; check references/florida-carriers.md for updates).
- **CSR (Cost-Sharing Reductions):** Available only on Silver plans for households 100-250% FPL. Three tiers: 94/87/73 AV.
- **Family Glitch Fix:** Employer offer of affordable self-only coverage no longer blocks family members from marketplace subsidies.
- **Income Estimation:** Use MAGI (Modified Adjusted Gross Income). Common pitfalls: forgetting to add back tax-exempt interest, not accounting for Roth conversions, underestimating self-employment income.

### Enrollment Periods

- **OEP (Open Enrollment Period):** November 1 – January 15 (federal marketplace). Florida uses HealthCare.gov.
- **SEP (Special Enrollment Period):** Qualifying life events — loss of coverage, marriage, birth/adoption, move, income change below 150% FPL (year-round SEP). Always verify the 60-day window from the qualifying event.
- **Medicaid Unwinding SEPs:** Check if residual SEPs from Medicaid unwinding are still active.
- **Plan Effective Dates:** Enrolled by 15th → 1st of next month. Enrolled 16th-end → 1st of month after next. OEP exception: December enrollments for Jan 1 effective date.

### Carrier Exclusions (Permanent)

NEVER include these carriers in any ACA dashboard, quoting tool, outreach list, or recommendation:
- **Aetna** — Left ACA Marketplace
- **Florida Blue** — No broker compensation
- **Capital HP** — Excluded
- **Bright Health** — Excluded
- **Medica** — Excluded
- **Wellmark** — Excluded
- **FL Health** — Excluded

When building tools, dashboards, or client-facing materials, filter these out programmatically. See `references/florida-carriers.md` for active carrier list and compensation notes.

### HealthSherpa Operations

HealthSherpa is the primary enrollment platform. Key operational notes:
- CSV exports from HealthSherpa are the source of truth for book of business data
- HuffSherpa (custom dashboard) imports these CSVs for outreach management
- Always maintain carrier filtering alignment between HealthSherpa data and HuffSherpa display
- Tier-based outreach: prioritize clients by renewal date proximity, then by premium (revenue impact)

---

## Medicare Operations

### Medicare Enrollment Periods

- **IEP (Initial Enrollment Period):** 7-month window around 65th birthday (3 months before, birthday month, 3 months after)
- **AEP (Annual Enrollment Period):** October 15 – December 7 (MAPD and PDP changes, effective Jan 1)
- **OEP (Medicare Open Enrollment):** January 1 – March 31 (switch MAPD to MAPD or drop to Original + PDP; one change only)
- **Med Supp Open Enrollment:** 6-month window starting the first day of the month you're 65+ AND enrolled in Part B. Guaranteed issue, no health questions. This is the golden window — after this, underwriting applies.
- **SEPs:** Dual-eligible, 5-star plan, moving out of service area, losing employer coverage, institutional, etc.

### Medicare Product Lines

1. **MAPD (Medicare Advantage + Prescription Drug):** HMO/PPO replacing Original Medicare. $0 premium common. Network-based.
2. **Medicare Supplement (Medigap):** Plans A through N. Standardized benefits by letter. Plan G most popular post-2020 (Plan F grandfathered). Premiums vary by carrier, age-rating method (attained-age vs. issue-age vs. community-rated).
3. **PDP (Prescription Drug Plan):** Standalone Part D. Pair with Original Medicare + Medigap. Check formulary, tier structure, donut hole/catastrophic coverage.
4. **D-SNP (Dual Special Needs Plan):** For dual-eligible (Medicare + Medicaid). Significant supplemental benefits.

### CMS Marketing Compliance (Medicare)

These rules are non-negotiable. Violations = fines, suspension, termination:

- **Scope of Appointment (SOA):** Must be signed BEFORE any Medicare sales appointment. 48-hour advance requirement (can be waived by beneficiary for same-day). Document and retain.
- **No Cold Calling:** Cannot make unsolicited calls about Medicare Advantage or PDP. Must have prior permission or existing relationship.
- **No Meals as Inducement:** Educational events at restaurants are fine; sales events cannot include meals.
- **T-FAR (Time, Food, Attendance, Recordings):** Educational events have different rules than sales events. Know the distinction.
- **Business Reply Cards (BRCs):** Can only call back about the product types the beneficiary checked.
- **Social Media:** Must include disclaimers. Cannot guarantee benefits. Must be filed/approved if carrier-specific.
- **Star Ratings:** Can reference them but cannot use them in a misleading way.
- **Disclaimer Required:** "We do not offer every plan available in your area. Currently we represent [number] organizations which offer [number] products in your area."

### IRMAA & LIS

- **IRMAA (Income-Related Monthly Adjustment Amount):** Higher-income Medicare beneficiaries pay surcharges on Part B and Part D. Based on MAGI from 2 years prior. Thresholds change annually.
- **LIS (Low-Income Subsidy / Extra Help):** Helps with Part D costs. Auto-enrolled if Medicaid/SSI. Others apply through SSA. Income ≤150% FPL + limited resources.

---

## Compliance Framework

### Florida Department of Insurance (DOI) / OIR

- All marketing materials must clearly identify the broker and license number
- NPN 18213932 and FL License W371813 must appear on client-facing materials
- Fixed-benefit/indemnity plans require clear disclaimer: "This is a fixed indemnity plan and is NOT comprehensive health insurance (major medical). It does not satisfy the requirement for Minimum Essential Coverage."
- Telemarketing rules: Florida has its own Do Not Call list in addition to federal
- Record retention: Maintain client records, SOAs, enrollment confirmations per Florida requirements

### ACA Compliance

- Cannot steer clients away from ACA to non-ACA products without documenting informed consent
- Must present all available metal levels when quoting marketplace plans
- Cannot misrepresent subsidy eligibility
- Annual certification required for marketplace enrollment

### HIPAA & Privacy

- Client health information gathered during enrollment is PHI
- Maintain secure systems for client data storage
- HealthSherpa handles PHI for enrollments; local CRM (HuffHealthApp) must also comply
- Never transmit PHI via unsecured channels

---

## Client Communications

### Tone & Brand Voice

- **Professional but approachable** — not stuffy, not salesy
- **"David the Insurance Dude"** energy on social/Facebook — organic, humorous, self-deprecating
- **Website/email:** Clean, direct, no insurance jargon walls. Mobile-first. No-scroll philosophy.
- **Never use:** "Buy now!" / "Limited time!" / "FREE" (CMS violation for Medicare; bad practice for ACA)
- **Always include** on marketing materials: License info, appropriate disclaimers per product type

### Facebook Post Guidelines

Keep tone organic, humorous, and self-deprecating (Lake Mirror walk post style):
- No pitching — let the brand work through photos and location tags
- Lifestyle-first, insurance-second
- Local Lakeland/Polk County flavor
- Engagement over conversion — build the long game

### Client Outreach Templates

When drafting client communications, always consider:
1. **What product line?** (ACA, Medicare, Ancillary) — different compliance rules apply
2. **What's the trigger?** (Renewal, SEP, new lead, service issue)
3. **What action do you want?** (Call back, click link, review plan, confirm info)
4. **What must be included?** (License number, disclaimers, opt-out for marketing)

---

## Lead Qualification & Sales

### Core Four Data Points

Every lead must capture: **Name, Phone, Email, Zip Code.** Anything beyond this adds friction. Qualify further on the call.

### Qualification Flow

1. **Zip Code → County → Available Carriers/Plans** (determines what you can sell)
2. **Household Size + Income → FPL% → Subsidy Estimate** (ACA)
3. **Age → Medicare eligibility timeline** (approaching 65, already on Medicare, dual-eligible)
4. **Current Coverage → Gap Analysis** (uninsured, underinsured, employer-offered, Medicaid)
5. **Trigger Event → Enrollment Path** (OEP, SEP type, Medicare IEP/AEP)

### Lead Sources & Priorities

- **BNI Referrals:** Highest conversion, prioritize follow-up within 24 hours
- **Facebook Ads:** Awareness-first campaigns, native-feel creatives, funnel to /get-help/ form
- **Website Organic:** SEO-driven, subsidy estimator as lead magnet
- **HealthSherpa Referrals:** Platform-generated leads
- **HealthMarkets Leads:** Backend-provided, variable quality

### Revenue Hierarchy (Focus Allocation)

1. **ACA Renewals** — Recurring annual commissions, compound growth, highest LTV
2. **ACA New Enrollments** — Grow the book during OEP/SEP
3. **Medicare AEP** — Seasonal revenue spike, October-December intensity
4. **Medicare Year-Round (T65, SEPs)** — Steady pipeline
5. **Ancillary (Dental/Vision, Fixed Indemnity)** — Supplemental revenue, cross-sell existing clients

---

## Technical Operations

### Stack Context

The broker operates a modern technical stack:
- **Website:** Next.js on Netlify (lakelandhealthinsurance.com)
- **CRM:** HuffHealthApp (Next.js, Prisma, PostgreSQL, Netlify)
- **Book of Business Dashboard:** HuffSherpa (standalone HTML, CSV import from HealthSherpa)
- **AI Agent:** Griff (terminal, web, SMS, Discord interfaces)
- **Dev Environment:** Mac Mini (primary/server) + MacBook Pro via Tailscale VPN
- **Primary Dev Tool:** Claude Code (terminal CLI), this chat for prototyping
- **Ad Platform:** Meta Business Suite (Facebook/Instagram)
- **Analytics:** Meta Pixel (ID: 1822900971216472)

### Automation Principles

When building tools or workflows:
1. **Does it scale?** If it requires manual work per client, redesign it
2. **Does it reduce friction?** Fewer clicks, fewer fields, faster outcomes
3. **Does it compound?** Recurring revenue > one-time transactions
4. **Does it create data?** Every interaction should feed analytics
5. **Is it compliant?** Build compliance into the system, don't bolt it on

---

## Reference Files

For detailed carrier data, compensation structures, and Florida-specific plan availability:
- See `references/florida-carriers.md` — Active carriers, metal level availability, network types, compensation notes, county-level availability patterns

When working on carrier-specific tasks, read the reference file first to ensure accuracy.
