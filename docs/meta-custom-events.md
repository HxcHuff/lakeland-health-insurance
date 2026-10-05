# Neutral Meta custom events

Dataset / Pixel ID: `1480756087079484`. Meta currently assigns this website data source **Health & wellness provider** (plus David’s **Financial service** category) and applies **Core setup** plus **blocked from sharing certain standard events**. Mid/lower-funnel standard events such as `Schedule` and `Lead` can return `events_received: 1` on CAPI while Events Manager never shows them. `PageView` still flows.

Use these **neutral custom events** for Ads Manager optimization until a category review lifts the block. Keep sending the matching standard event where it already exists so it works if restrictions later lift.

Custom event names and `custom_data` keys/values must not include health, Medicare, insurance, or financial words. Prefer empty `custom_data`. Never send Calendly invitee or form-field PII.

## Implemented now

| Custom event | Standard event kept | Trigger | Pixel | CAPI | Dedup |
|---|---|---|---|---|---|
| `booking_complete` | `Schedule` | Calendly `event_scheduled` on `/book/` | `fbq('trackCustom', 'booking_complete', {}, {eventID})` plus image `/tr` | Same `POST /api/calendly-schedule` as `Schedule` | Distinct `event_id` from `Schedule` (`lhi_book_{prefix}_bcomp` or a second approved id) |
| `form_submit_complete` | `Lead` | Netlify Forms-accepted sales/service submit via `/api/lead` | Not on the site today (`Lead` is CAPI-only; GTM owns browser GA4) | Same Graph POST `data[]` as `Lead` | Distinct `event_id` (`lhi_book_{prefix}_fcomp`) |

`booking_complete` is the Book now optimization event until `Schedule` appears in Events Manager. See [`meta-booked-appointment-conversion.md`](meta-booked-appointment-conversion.md).

`form_submit_complete` is the form-submit optimization event until `Lead` appears in Events Manager. Do not point Book now at it. Newsletter submits still skip both `Lead` and `form_submit_complete`.

## Documented only (no Meta send yet)

These have a site hook or are common restricted standard events. Do not invent Pixel/CAPI traffic until a later task wires a real conversion path.

| Custom event | If a standard event is added later | Current site hook | Pixel | CAPI | Status |
|---|---|---|---|---|---|
| `phone_click` | `Contact` | `lhiTrackPhoneClick` in `js/analytics.js`; `PhoneCallClick` fallback in `js/funnel.js` on `tel:` | Not sent | Not sent | Stub. GA4 only today. `Contact` is also typically blocked on this restriction tier. |
| `message_start` | `Contact` | `js/funnel.js` `messenger_click` on `a[href*="m.me/"]` | Not sent | Not sent | Stub. GA4 only today. |
| *(none)* | `CompleteRegistration` | No site trigger | — | — | No account-create or registration complete path. |
| *(none)* | `SubmitApplication` | No site trigger | — | — | No application-submit path. |
| *(none)* | `Purchase` | No site checkout | — | — | No ecommerce purchase event. |
| *(none)* | `AddToCart` / `InitiateCheckout` / `AddPaymentInfo` | No cart | — | — | Not used. |

Calendly **link clicks** on other pages fire a GA4 `Schedule` diagnostic in `js/funnel.js`. That is not a Meta conversion. Meta `Schedule` / `booking_complete` remain reserved for a completed booking on `/book/`.

## Naming and payload rules

- Approved custom names: `booking_complete`, `form_submit_complete`, `phone_click`, `message_start`.
- `booking_complete` and `form_submit_complete` send no `custom_data` object.
- `Schedule` and `Lead` keep their existing `custom_data` (`calendly_booking_completed` / `first_party_lead`) so current CAPI contracts stay intact.
- Pixel `eventID` and CAPI `event_id` must match **per event name**. Two event names on one booking or form submit must use two ids.

## After deploy

1. Complete one production `/book/` appointment and one Forms-accepted form submit (or use Events Manager Test events).
2. Confirm `booking_complete` and `form_submit_complete` appear for dataset `1480756087079484`.
3. Create Ads Manager **custom conversions** on those event names (neutral labels such as “Booking complete”). Do not put health wording in the conversion name.
4. Point Book now ad set `120252243350740324` at the `booking_complete` custom conversion. Leave the ad set paused until confirmed; David approves any unpause.
5. Do not switch optimization back to `Schedule` or `Lead` until Events Manager Overview shows those standard events.
