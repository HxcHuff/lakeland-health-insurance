# Meta conversion for completed Calendly bookings

Use this after the booking-page events are live on production. The goal is for Facebook Ads Manager to optimize and report **booked appointments**, not landing-page views.

Meta data-source restrictions on dataset `1480756087079484` (Health & wellness provider + Financial service; Core setup + blocked mid/lower-funnel standard events) can accept CAPI `Schedule` (`events_received: 1`) while Events Manager never shows `Schedule`. Until that block lifts, optimize Book now on the neutral custom event **`booking_complete`**. Keep sending **`Schedule`** so it works if review later unblocks it.

The full custom-event inventory is in [`meta-custom-events.md`](meta-custom-events.md).

## What the site sends

| Item | Value |
|---|---|
| Ad landing URL | `https://lakelandhealthinsurance.com/calendly-book.html` (301 to `/book/`) |
| Canonical booking page | `https://lakelandhealthinsurance.com/book/` |
| Dataset / Pixel ID | `1480756087079484` (Events Manager name: Lakeland Health insurance) |
| Browser events | Standard Meta **`Schedule`** via `fbq('track', 'Schedule', {}, {eventID})` **and** custom **`booking_complete`** via `fbq('trackCustom', 'booking_complete', {}, {eventID})`, each with Meta’s official image `/tr` backup |
| Server events | Same **`Schedule`** and **`booking_complete`** in one Conversions API POST from `/api/calendly-schedule` |
| Dedup | Pixel and CAPI share one `event_id` per event name. `Schedule` and `booking_complete` use **distinct** ids (Schedule keeps the booking UUID / `lhi_book_*` id; `booking_complete` uses `lhi_book_{prefix}_bcomp` or a second approved id) |
| Trigger | Calendly `event_scheduled` from the embedded calendar, not a Book-now click |
| Custom params | `booking_complete` sends no `custom_data`. No invitee or form fields. No health, Medicare, insurance, or financial words in the custom event name or params |

The booking page loads Calendly’s official inline iframe from `calendly.com` in `js/calendly-meta-schedule.js`. It does not put a third-party account string in the page HTML. A same-origin `/book/embed` rewrite is not used for the live calendar because Calendly’s booking API would then call `/api/booking/*` on this host and fail. Neither event includes invitee name, email, phone, notes, or other calendar details.

This is separate from the consent-gated website-audience `PageView` loader. `/book/` is not an audience-PageView page.

## Confirm Netlify production variables

The Pixel ID is already in site code. The Conversions API reuses the same production secrets already used for form `Lead` events. Custom events use that same token. Do not put tokens in the repo.

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
5. Confirm **`booking_complete`** from `/book/` with matching Pixel and CAPI rows (same custom `event_id`). `Schedule` may also appear if restrictions have lifted; if it does not, that is the known data-source block, not a site miss. The booking page should not log `Duplicate Pixel ID 1480756087079484`.
6. In Chrome DevTools → Network, filter `tr`. After the Calendly confirmation, there must be a request to `facebook.com/tr` with `ev=Schedule` and `eid=` equal to `__LHI_CALENDLY_META_STATUS__.event_id`, and another with `ev=booking_complete` and `eid=` equal to `__LHI_CALENDLY_META_STATUS__.custom_event_id`. Those ids must match the CAPI `POST /api/calendly-schedule` body `event_id` and `custom_event_id`. PageView `/tr` hits alone are not enough. The site fires `fbq('track'/'trackCustom', …, {eventID})` plus Meta’s official image `/tr` with the same eids, so a GET still leaves if GTM already owns `fbq`.
7. Do not treat a Calendly click, a page view, or `Lead` / `form_submit_complete` as the booking result.
8. If Events Manager still shows two `Schedule` or two `booking_complete` rows for one booking, check Calendly → Integrations → Facebook Pixel and remove dataset `1480756087079484` there. The site Pixel + CAPI path is the source of truth. The browser `track` / `trackCustom` calls and the image `/tr` hits share those same `event_id`s with CAPI, so Meta should collapse each name.

Then switch OEP 2027 Book now ad set `120252243350740324` to Maximize conversions → a **custom conversion on `booking_complete`**, not `Schedule`, until Overview shows `Schedule`.

## Ads Manager steps: switch Book now from Landing Page Views to booking_complete

Campaign and ad set IDs supplied for this work:

- Campaign name: **OEP 2027**
- Ad set ID: `120252243350740324` (Book now / Request time)

Exact clicks:

1. Open [Ads Manager](https://adsmanager.facebook.com/).
2. Select the ad account that owns dataset **Lakeland Health insurance**.
3. After Events Manager shows at least one production `booking_complete`, create a **custom conversion** on that custom event. Use a neutral name such as “Booking complete”. Do not put health, Medicare, insurance, or financial words in the conversion name.
4. Open campaign **OEP 2027**.
5. Open ad set `120252243350740324` (Book now / Request time) and click **Edit**.
6. Go to **Conversion** / **Optimization and delivery** (wording varies slightly by Ads Manager version).
7. Set the performance goal to **Maximize number of conversions** (or **Conversions**), not Landing page views or Link clicks.
8. Conversion location: **Website**.
9. Dataset: **Lakeland Health insurance** (`1480756087079484`).
10. Conversion event: the **`booking_complete`** custom conversion (or the custom event itself if Ads Manager offers it).
    - Do **not** optimize on `Schedule` while Events Manager Overview still lacks `Schedule`.
    - When Overview shows `Schedule`, David can choose to move this ad set back to the standard event.
    - Do not create a second custom event named BookedAppointment.
11. Attribution setting: keep the account default unless David has a documented reason to change it (usually 7-day click / 1-day view).
12. Leave the ad set paused until the custom conversion is confirmed. Ask David before unpausing. This repo does not change Ads Manager.

After publishing:

- The ad set re-enters learning. That is expected when the optimization event changes.
- Ads Manager results for this ad set should start counting **`booking_complete`** instead of Landing page views.
- Landing page views can remain as a diagnostic column. They are no longer the optimization result.

## What not to change

- Do not optimize this ad set to `Lead` or `form_submit_complete`. Those are form-submission events, not a booked appointment.
- Do not optimize to a Calendly click. Site `Schedule` on other pages can still mean “calendar link clicked” in GA4; Meta `Schedule` and `booking_complete` are reserved for a completed booking from `/book/`.
- Do not add HealthMarkets branding to ads or the booking page.
- Do not change dataset `1480756087079484` or Ads Manager from this repo.
