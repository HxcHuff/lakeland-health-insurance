# Canonical Entity Contract

Contract version: 2026-07-31
Scope: Lakeland Health Insurance website identity, authority, authorship, and structured-data references

## Canonical IDs

| Entity | Type | Canonical ID | Decision |
|---|---|---|---|
| Website | `WebSite` | `https://lakelandhealthinsurance.com/#website` | Preserve existing stable ID |
| Agency/DBA | `InsuranceAgency` | `https://lakelandhealthinsurance.com/#agency` | Preserve existing stable ID; do not introduce `#organization` |
| David Huff | `Person` | `https://lakelandhealthinsurance.com/about/#david-huff` | Preserve existing stable profile ID |
| Homepage | `WebPage` | `https://lakelandhealthinsurance.com/#webpage` | Homepage-only page node |
| About profile | `ProfilePage` | `https://lakelandhealthinsurance.com/about/#profile` | About-only profile node |

`#agency` is retained instead of creating `#organization` because it is already referenced by the current priority pages and accurately communicates the public service entity. Adding another organization ID would fragment the graph.

## David Huff contract

### Required properties

| Property | Required value or rule |
|---|---|
| `@type` | `Person` |
| `@id` | `https://lakelandhealthinsurance.com/about/#david-huff` |
| `name` | `David Huff` |
| `jobTitle` | `Licensed health insurance agent and broker` |
| `url` | `https://lakelandhealthinsurance.com/about/` |
| `telephone` | `+1-863-640-3102` |
| `email` | `dhuff@healthmarkets.com` |
| Florida license identifier | `W371813` |
| NPN identifier | `18213932` |
| Relationship | `worksFor` references `https://lakelandhealthinsurance.com/#agency` on the canonical profile |

### Optional evidence-backed properties

- `alternateName: David The Insurance Dude` where that public brand is visible on the page.
- `hasCredential` for the Florida insurance license.
- Narrow `knowsAbout` terms only when the visible page supports them and the term does not imply an appointment, certification, or availability claim.
- `sameAs` only under the evidence policy below.

### Prohibited or unverified properties

- Awards, rankings, “best/top” status, aggregate ratings, review counts, years of experience, military history, degrees, certifications, or professional designations without current evidence.
- Carrier appointments, plan availability, statewide product availability, provider relationships, or enrollment-platform certification inferred from the license or NPN.
- A physical office address or office hours unless currently verified and intentionally published.
- `founder` or ownership/legal-entity claims unless David approves and current business evidence supports the exact relationship.

## Lakeland Health Insurance contract

### Required identity

- Name: `Lakeland Health Insurance`.
- Type: `InsuranceAgency` for structured-data purposes.
- Relationship: the public-facing DBA/site identity led by David Huff.
- URL: `https://lakelandhealthinsurance.com/`.
- Phone: `+1-863-640-3102`.
- Email: `dhuff@healthmarkets.com`.
- Service posture: local assistance in Lakeland and Polk County; remote assistance across Florida, subject to product and plan validation.
- Mandatory boundary: `Lakeland Health Insurance is not an insurance carrier.`

### Approved compensation language

> Insurance carriers generally compensate appointed brokers when an enrollment is completed. David does not charge a separate fee for the plan-review assistance described on this site. Compensation and availability can differ by carrier and product.

Do not shorten this to “free,” “same price,” “no cost for everything,” or language implying compensation cannot affect the available product set. HealthCare.gov states that consumers do not pay an additional amount when enrolling with an agent or broker, that brokers often receive carrier commissions, and that a broker may not sell every company's plans.

### Required structured-data properties

| Property | Rule |
|---|---|
| `@id` | `https://lakelandhealthinsurance.com/#agency` |
| `name` | `Lakeland Health Insurance` |
| `url` | Canonical homepage with trailing slash |
| `telephone` / `email` | Contract values above |
| `description` | Must state the David/DBA relationship, local/Florida posture, availability limits, and non-carrier boundary |
| `areaServed` | Follow the policy below |

### Optional evidence-backed properties

- `alternateName: David The Insurance Dude` when visible.
- Official first-party social/business profile URLs that pass the `sameAs` evidence policy.
- Specific `Service` nodes on a page that visibly describes the service and its geographic/product limits.

### Prohibited or unverified properties

- `PostalAddress`, geo coordinates, opening hours, price range, awards, aggregate ratings, review counts, employee counts, or legal registration status without current evidence and an intentional publishing decision.
- `Offer`, `OfferCatalog`, price, carrier, benefit, premium, savings, provider, formulary, or availability schema without current product/state evidence and visible parity.
- Any type or description that presents Lakeland Health Insurance as an insurer or carrier.

## `areaServed` policy

The canonical agency graph may use only:

1. Lakeland as `City` contained in Florida.
2. Polk County as `AdministrativeArea` contained in Florida.
3. Florida as `AdministrativeArea`.

Do not enumerate city lists on the canonical agency node. Page-specific local content may name another city or county in visible copy, but that does not automatically expand the canonical agency `areaServed` graph.

“Remote assistance across Florida” is a service-delivery statement, not a claim that every carrier, product, plan, provider, enrollment route, or in-person service is available statewide. Every material product claim must remain qualified by ZIP code, county, eligibility, appointment/certification where applicable, and plan year.

## Page and relationship rules

### Homepage

- Defines the canonical `WebSite` and `InsuranceAgency` nodes.
- `WebSite.publisher` references `#agency`.
- `WebPage.mainEntity` references `#agency`.
- `WebPage.author` and `reviewedBy` reference `/about/#david-huff` when David actually authored/reviewed the content.
- May reference David's canonical ID without repeating the full Person object.
- Must not publish Offer schema for unverified product inventory.

### About page

- Defines David's full `Person` node and the `ProfilePage` node.
- `Person.worksFor` references `#agency`.
- `ProfilePage.mainEntity` references David.
- `ProfilePage.publisher` and `about` reference `#agency`.
- `ProfilePage.isPartOf` references `#website`.
- Does not repeat the full agency graph.

### Service pages

- Use `WebPage` plus `Service` only when the service is visibly described.
- `Service.provider` references `#agency`.
- `author`/`reviewedBy` reference David only when factually correct.
- `areaServed` must match visible scope and cannot establish product availability.

### Articles and guides

- Use `Article` or `BlogPosting`, not both unless the chosen type hierarchy is intentional.
- `author` and `reviewedBy` reference David only when he performed those roles.
- `publisher` references `#agency`; `isPartOf` references `#website`.
- Time-sensitive insurance content requires applicable state, product/coverage year, current primary sources, and visible reviewed date.

### FAQ pages

- Use `FAQPage` only when every marked-up question and answer is visible on the page.
- Schema text must remain materially identical to visible text.
- Do not use FAQ schema as template decoration or to introduce claims absent from visible content.

## `sameAs` evidence policy

A `sameAs` URL is allowed only when all conditions pass:

1. The profile is controlled by David or Lakeland Health Insurance, or it is an authoritative regulator/business directory record.
2. The profile visibly identifies the same person or DBA.
3. The URL is current and directly reviewed, not inferred from search-result text.
4. The page does not require publishing protected, account, or client information.
5. Review date and evidence owner are recorded internally.

Search-result pages may be used as a consumer path to current feedback, but they are not `sameAs` identity evidence. Review excerpts, ratings, and counts require a direct current source URL and review date; otherwise link to the source without copying the claim.

## Source and review-date requirements

| Claim class | Required evidence | Review cadence |
|---|---|---|
| License and NPN | Florida DFS/NIPR | Before release and at least annually; immediately after a known status change |
| Marketplace dates/rules | CMS, HealthCare.gov, Federal Register | Each plan year and after source changes |
| Medicare dates/rules | CMS/Medicare.gov | Each contract year and after source changes |
| Broker compensation description | HealthCare.gov/CMS plus David's approved business practice | Annual and after compensation/process changes |
| Product, carrier, plan, county, provider, formulary | Current carrier/CMS/official plan evidence | Before publication and by plan year; more often when sources change |
| Reviews, ratings, BBB/profile status | Direct current third-party profile | At each publication/update; avoid copying if stable direct evidence is unavailable |

For a regulated claim, record source URL, accessed date, applicable year, state, product line, review status, and reviewer. If the source is unavailable or conflicting, qualify or remove the claim; do not infer.

## Visible-content-to-schema parity

1. Every material schema claim must be visible or be a neutral technical relationship such as `isPartOf`.
2. Schema cannot broaden geography, product availability, credentials, compensation, ratings, reviews, or affiliation beyond visible copy.
3. Visible identity values and schema values must match exactly for name, phone, email, license, NPN, canonical URL, and entity ID.
4. “Independent” describes the broker's comparison role; it does not mean every carrier or plan is represented.
5. Statewide assistance must carry the visible availability boundary.
6. If an entity value changes, update `data/authority-entities.json`, canonical pages, validators, and affected references in the same work package.

## Canonical source registry

`data/authority-entities.json` is the machine-readable identity registry. This document is the governing semantic contract. Page markup must conform to both; neither is proof of production deployment or external-account state.
