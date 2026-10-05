# Meta conversion for completed Calendly bookings

Use this after the booking-page `Schedule` event is live on production. The goal is for Facebook Ads Manager to optimize and report **booked appointments**, not landing-page views.

## What the site sends

| Item | Value |
|---|---|
| Ad landing URL | `https://lakelandhealthinsurance.com/calendly-book.html` (301 to `/book/`) |
| Canonical booking page | `https://lakelandhealthinsurance.com/book/` |
| Dataset / Pixel ID | `1480756087079484` (Events Manager name: Lakeland Health insurance) |
| Browser event | Standard Meta event **`Schedule`** |
| Server event | Same **`Schedule`** through Conversions API, deduped with the browser `event_id` |
| Trigger | Calendly `event_scheduled` from the embedded calendar, not a Book-now click |

The booking page loads Calendly’s official inline iframe from `calendly.com` in `js/calendly-meta-schedule.js`. It does not put a third-party account string in the page HTML. A same-origin `/book/embed` rewrite is not used for the live calendar because Calendly’s booking API would then call `/api/booking/*` on this host and fail. `Schedule` does not include invitee name, email, phone, notes, or other calendar details.

This is separate from the consent-gated website-audience `PageView` loader. `/book/` is not an audience-PageView page.

## Confirm Netlify production variables

The Pixel ID is already in site code. The Conversions API reuses the same production secrets already used for form `Lead` events. Do not put tokens in the repo.

| Variable | Where | Required for | Notes |
|---|---|---|---|
| `META_PIXEL_ID` | Netlify → Site configuration → Environment variables → **Production** | CAPI | Must equal `1480756087079484`. If this is missing or different, CAPI is skipped. |
| `META_CAPI_ACCESS_TOKEN` | Same Netlify production scope | CAPI | Already used by `/api/lead`. If it is blank, Pixel can still fire in the browser, but Ads Manager matching is weaker. Do not paste the token into chat, Git, or this file. |
| `META_CAPI_TEST_EVENT_CODE` | Optional, production or a short test window | Events Manager test events | Leave blank for normal collection. |
| `LHI_SITE_ENV` / `CONTEXT` | Set by `netlify.toml` production context | CAPI | Production only. Preview and branch deploys stay quiet. |

If CAPI is not arriving in Events Manager after a real production booking:

1. In Netlify, open the production scope (not deploy-preview).
2. Confirm `META_PIXEL_ID` is exactly `1480756087079484`.
3. Confirm `META_CAPI_ACCESS_TOKEN` is present and not empty. If it is missing, add the token from Meta Events Manager → Settings → Conversions API / Generate access token for dataset `1480756087079484`.
4. Redeploy production after saving variables.

## Verify the event before changing the ad set

After a production deploy of the calendar-origin embed:

1. Open `https://lakelandhealthinsurance.com/book/` and confirm the calendar draws selectable times (not a blank iframe). Cached `/book/embed` hits 302 to Calendly; the live page no longer uses that rewrite.
2. Open [Meta Events Manager](https://business.facebook.com/events_manager2) → Test events.
3. Select dataset **Lakeland Health insurance** (`1480756087079484`).
4. Complete one booking on `https://lakelandhealthinsurance.com/book/`.
5. Confirm **one** **`Schedule`** event from `/book/` with matching Pixel and CAPI rows (same `event_id`). The booking page should not log `Duplicate Pixel ID 1480756087079484`.
6. Do not treat a Calendly click, a page view, or `Lead` as the booking result.
7. If Events Manager still shows two `Schedule` rows for one booking, check Calendly → Integrations → Facebook Pixel and remove dataset `1480756087079484` there. The site Pixel + CAPI path is the source of truth.

Then switch OEP 2027 Book now ad set `120252243350740324` to Maximize conversions → event **`Schedule`** using the Ads Manager steps below.

## Ads Manager steps: switch Book now from Landing Page Views to Schedule

Campaign and ad set IDs supplied for this work:

- Campaign name: **OEP 2027**
- Ad set ID: `120252243350740324` (Book now / Request time)

Exact clicks:

1. Open [Ads Manager](https://adsmanager.facebook.com/).
2. Select the ad account that owns dataset **Lakeland Health insurance**.
3. Open campaign **OEP 2027**.
4. Open ad set `120252243350740324` (Book now / Request time) and click **Edit**.
5. Go to **Conversion** / **Optimization and delivery** (wording varies slightly by Ads Manager version).
6. Set the performance goal to **Maximize number of conversions** (or **Conversions**), not Landing page views or Link clicks.
7. Conversion location: **Website**.
8. Dataset: **Lakeland Health insurance** (`1480756087079484`).
9. Conversion event: **`Schedule`**.
   - If `Schedule` is listed under standard events, select it directly.
   - If it is not listed yet, wait until Events Manager has received at least one production `Schedule`, refresh the ad set editor, and select it. Do not create a second custom event named BookedAppointment unless `Schedule` is unavailable.
10. Attribution setting: keep the account default unless David has a documented reason to change it (usually 7-day click / 1-day view).
11. Publish the ad set.

After publishing:

- The ad set re-enters learning. That is expected when the optimization event changes.
- Ads Manager results for this ad set should start counting **`Schedule`** instead of Landing page views.
- Landing page views can remain as a diagnostic column. They are no longer the optimization result.

## What not to change

- Do not optimize this ad set to `Lead`. `Lead` is the form-submission event, not a booked appointment.
- Do not optimize to a Calendly click. Site `Schedule` on other pages can still mean “calendar link clicked” in GA4; Meta `Schedule` is reserved for a completed booking from `/book/`.
- Do not add HealthMarkets branding to ads or the booking page.
