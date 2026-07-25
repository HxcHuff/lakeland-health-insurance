# Funnel Implementation Report

Date: 2026-07-25
Branch: `codex/funnel-measurement-attribution`

## Workstreams Completed

### Measurement and Attribution

- Added `FUNNEL-EVENT-DICTIONARY.md`.
- Updated `js/funnel.js` for page-type classification, first/current-touch attribution, Lead dedupe, Subscriber separation, ServiceRequest separation, Schedule tracking, PhoneClick, MessengerClick, and SelfServiceQuoteClick.
- Kept Lead values centralized and intentionally set to `0` pending approved business inputs.
- Added new Lead form names to `netlify/functions/lead.js` Mailchimp tagging map.

### Intake UX

- Rebuilt `/get-help/` with:
  - no nested scroll trap;
  - contact capture after two meaningful questions;
  - phone as primary contact and email optional;
  - progress indicator;
  - back navigation;
  - accessible labels, focusable error summary, and consent;
  - hidden honeypots outside sighted, keyboard, and assistive-technology flow;
  - non-guaranteed response language plus call and schedule options.

### Thank-You Routing

- Updated `thanks.html` with intent-specific safe content for:
  - general Get Help;
  - coverage change;
  - turning 65;
  - provider network;
  - aging off 26;
  - self-employed;
  - employer offboarding;
  - newsletter;
  - client review;
  - post-enrollment.
- Removed unsupported response-time and savings-testimonial language.

### New Funnel Pages

Public acquisition funnels:

- `/coverage-change-checkup/`
- `/turning-65-medicare-countdown/`
- `/provider-prescription-check/`
- `/aging-off-26/`
- `/self-employed-income-checkup/`
- `/employer-offboarding/`

Client service funnels:

- `/client-review/` with `noindex, follow`
- `/post-enrollment-checkup/` with `noindex, follow`

### CTA and Link Architecture

- Homepage primary CTA remains the coverage review path.
- Homepage now routes turning-65, coverage-change, self-employed, employer-offboarding, provider/Rx, client-review, and post-enrollment traffic to dedicated funnels.
- Updated relevant source pages:
  - job-loss article -> Coverage Change Checkup;
  - ACA Lakeland page -> Coverage Change Checkup;
  - Medicare hub -> Turning 65 and Provider/Rx;
  - provider article -> Provider/Rx;
  - turning-65 article -> Medicare Countdown;
  - college/student article -> Aging Off at 26;
  - freelancer article -> Self-Employed Income Checkup.
- Added newsletter Under 65 / Medicare / Both preference segmentation.

## Funnel and Event Matrix

| Funnel | Route | Primary CTA | Event | Page Type | Follow-Up |
| --- | --- | --- | --- | --- | --- |
| General review | `/get-help/` | Send My Request | `Lead` | `get_help` | `/thanks.html?intent=get_help` |
| Coverage change / COBRA | `/coverage-change-checkup/` | Check My Timing and Options | `Lead` | `coverage_change` | `/thanks.html?intent=coverage_change` |
| Turning 65 | `/turning-65-medicare-countdown/` | Build My Medicare Countdown | `Lead` | `turning_65` | `/thanks.html?intent=turning_65` |
| Provider/Rx fit | `/provider-prescription-check/` | Check My Doctors and Prescriptions | `Lead` | `provider_network` | `/thanks.html?intent=provider_network` |
| Aging off 26 | `/aging-off-26/` | Review My Coverage Timeline | `Lead` | `aging_off_26` | `/thanks.html?intent=aging_off_26` |
| Self-employed income | `/self-employed-income-checkup/` | Review My Income Estimate | `Lead` | `self_employed` | `/thanks.html?intent=self_employed` |
| Employer offboarding | `/employer-offboarding/` | Request the Employee Transition Guide | `Lead` | `employer_offboarding` | `/thanks.html?intent=employer_offboarding` |
| Annual client review | `/client-review/` | Request My Annual Review | `ServiceRequest` | `client_review` | `/thanks.html?intent=client_review` |
| 30-day checkup | `/post-enrollment-checkup/` | Request My 30-Day Checkup | `ServiceRequest` | `post_enrollment` | `/thanks.html?intent=post_enrollment` |
| Newsletter | `/newsletter/` and homepage | Subscribe | `Subscriber` | `newsletter` or `home` | `/thanks.html?intent=newsletter` where configured |

## Tests and Results

Commands run:

- `node --test tests/*.mjs` - pass, 26 tests
- `node --check js/intent-funnels.js` - pass
- `node --check js/funnel.js` - pass
- `node --check netlify/functions/lead.js` - pass
- `node --check scripts/check-internal-links.mjs` - pass
- `node scripts/validate-pages.mjs` - pass, 143 HTML files
- `node scripts/check-internal-links.mjs` - pass
- `git diff --check` - pass
- Local preview route checks on `http://127.0.0.1:4173/` - pass for `/get-help/`, all new funnel routes, CSS asset, and representative thank-you intents

## Compliance Review Checklist

Needs human compliance review before deployment:

- Medicare disclaimer wording on `/turning-65-medicare-countdown/`.
- Consent language across all new forms.
- Employer offboarding language to confirm it does not imply HR/legal advice.
- Self-employed income page to confirm tax-disclaimer boundaries.
- Coverage-change page for SEP/COBRA wording and document checklist.
- Fixed-indemnity/supplemental language on post-enrollment page.

## Business Inputs Still Needed

- Approved lead values or relative values for Google Ads conversion value configuration.
- Whether client service requests should enter the same CRM workflow as sales leads or a separate service queue.
- Newsletter welcome content copy for Under 65 / Medicare / Both. The forms capture preference, but no email automation is claimed.
- Any approved downloadable handouts for employer offboarding or Medicare countdown. Current implementation is form-first and page-first.

## Known Limitations

- No live Tag Assistant validation was performed in this local run.
- No live forms were submitted.
- Netlify form detection should be verified in deploy preview before production release.
- The local static preview cannot emulate Netlify rewrites, Functions, or production Google/Ads behavior.
- Playwright browser automation could not run because the local Playwright Chromium binary is not installed. No browser download was performed.

## Deployment Recommendation

1. Review the branch diff.
2. Run local checks again:
   - `node --test tests/*.mjs`
   - `node scripts/validate-pages.mjs`
   - `node scripts/check-internal-links.mjs`
   - `git diff --check`
3. Commit the approved scope.
4. Push the branch and open a deploy preview.
5. Verify deploy preview:
   - page rendering for all new routes;
   - Netlify form detection;
   - no console errors;
   - no duplicate Lead, Subscriber, Schedule, or ServiceRequest events in preview QA mode;
   - all forms route to correct thank-you intent.
6. After production deploy, use Tag Assistant / GA4 DebugView / Google Ads conversion diagnostics to confirm event ownership.

## Rollback

- Revert the release commit.
- Confirm old `/get-help/`, `/thanks.html`, `js/funnel.js`, `_redirects`, and `sitemap.xml` return to the previous deployed versions.
- Re-run `node scripts/validate-pages.mjs` and a cache-busted production check after rollback deploy.
