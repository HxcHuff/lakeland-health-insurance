# Consent text versions

Recorded 2026-09-29. Each `html` block is copied verbatim from the live form markup. `tests/consent-versions.test.mjs` asserts that these strings still appear in the listed pages so the stored version cannot drift from the wording the visitor saw.

`none` is not an allowlisted client version. City `*-health-insurance` forms collect no SMS consent, so the lead function stores `consent_sms=no`, `consent_text_version=none`, and `consent_version_source=none`.

The `lp-*-2026-09-29-v1` strings remain on the server allowlist for older leads. Live paid landing pages now render the matching `v2` labels. Drift checks skip superseded sections.

## get-help-2026-07-30-v1

- Date: 2026-07-30
- Forms: `get-help` sitelink radio forms
- ACA Lakeland and Polk County sitelink forms use the `request` and `call` labels only; contact authorization is phone-call-only on those pages.
- Pages:
  - `aca-health-insurance-agent-polk-county-fl/index.html`
  - `aca-health-insurance-lakeland-fl/index.html`
  - `medicare/index.html`

### request

```html
I am asking Lakeland Health Insurance to review and respond to this insurance request. I understand this is not an enrollment, eligibility determination, or proof of coverage.
```

### call

```html
I authorize a telephone call about this request.
```

### sms

```html
I authorize text messages about this request. Message frequency varies; message and data rates may apply. Reply STOP to cancel or HELP for help. See <a href="/sms-policy.html" target="_blank" rel="noopener noreferrer">SMS Terms</a>.
```

### email

```html
I authorize email about this request.
```

## get-help-2026-09-29-v2

- Date: 2026-09-29
- Forms: `/get-help/` intake and the `/medicare-2027-check/` and `/aca-2027-check/` demand-gen landings (call and SMS labels match; the demand-gen pages have no email field)
- Pages:
  - `get-help/index.html`
  - `medicare-2027-check/index.html` (omits the email channel checkbox)
  - `aca-2027-check/index.html` (omits the email channel checkbox)

### request

```html
I am asking Lakeland Health Insurance to review and respond to this insurance request. I understand this is not an enrollment, eligibility determination, or proof of coverage.
```

### call

```html
I authorize a telephone call about this request.
```

### sms

```html
By checking this box, I give my prior express consent for Lakeland Health Insurance (David Huff, licensed insurance agent) to send text messages about this request to the mobile number I entered above. Consent is not a condition of purchase. Message frequency varies; msg &amp; data rates may apply. Reply STOP to cancel or HELP for help. See <a href="/sms-policy.html" target="_blank" rel="noopener noreferrer">SMS Terms</a> and <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
```

### email

```html
I authorize email about this request.
```

## lp-aca-2026-09-29-v1

- Date: 2026-09-29
- Status: superseded 2026-09-29 by `lp-aca-2026-09-29-v2`
- Forms: `lp-aca-lead` (historical)
- Pages:
  - `lp/aca/index.html`

### consent

```html
By checking this box, I agree to receive calls and texts from Lakeland Health Insurance about my insurance request at the number provided. Consent is not a condition of purchase. Message frequency varies. Message and data rates may apply. Reply STOP to cancel or HELP for help.
```

## lp-medicare-2026-09-29-v1

- Date: 2026-09-29
- Status: superseded 2026-09-29 by `lp-medicare-2026-09-29-v2`
- Forms: `lp-medicare-lead` (historical)
- Pages:
  - `lp/medicare/index.html`

### consent

```html
By checking this box, I agree to receive calls and texts from Lakeland Health Insurance about my Medicare request at the number provided. Consent is not a condition of purchase. Message frequency varies. Message and data rates may apply. Reply STOP to cancel or HELP for help.
```

## lp-gap-2026-09-29-v1

- Date: 2026-09-29
- Status: superseded 2026-09-29 by `lp-gap-2026-09-29-v2`
- Forms: `lp-gap-lead` (historical)
- Pages:
  - `lp/gap/index.html`

### consent

```html
By checking this box, I agree to receive calls, texts, and emails from Lakeland Health Insurance about my insurance request at the contact information provided. Consent is not a condition of purchase. Message frequency varies. Message and data rates may apply. Reply STOP to cancel or HELP for help.
```

## lp-aca-2026-09-29-v2

- Date: 2026-09-29
- Forms: `lp-aca-lead`
- Pages:
  - `lp/aca/index.html`

### consent

```html
By checking this box, I give my prior express written consent for Lakeland Health Insurance (David Huff, licensed insurance agent) to contact me about my insurance request, including marketing calls and text messages, at the phone number I provided, which may be sent using an automated system for the selection or dialing of telephone numbers. Consent is not a condition of purchase. Message frequency varies. Message and data rates may apply. Reply STOP to cancel or HELP for help. See <a href="/sms-policy.html" target="_blank" rel="noopener noreferrer">SMS Terms</a> and <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
```

## lp-medicare-2026-09-29-v2

- Date: 2026-09-29
- Forms: `lp-medicare-lead`
- Pages:
  - `lp/medicare/index.html`

### consent

```html
By checking this box, I give my prior express written consent for Lakeland Health Insurance (David Huff, licensed insurance agent) to contact me about my Medicare request, including marketing calls and text messages, at the phone number I provided, which may be sent using an automated system for the selection or dialing of telephone numbers. Consent is not a condition of purchase. Message frequency varies. Message and data rates may apply. Reply STOP to cancel or HELP for help. See <a href="/sms-policy.html" target="_blank" rel="noopener noreferrer">SMS Terms</a> and <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
```

## lp-gap-2026-09-29-v2

- Date: 2026-09-29
- Forms: `lp-gap-lead`
- Pages:
  - `lp/gap/index.html`

### consent

```html
By checking this box, I give my prior express written consent for Lakeland Health Insurance (David Huff, licensed insurance agent) to contact me about my insurance request, including marketing calls and text messages at the phone number I provided, which may be sent using an automated system for the selection or dialing of telephone numbers, and emails at the email address I provided. Consent is not a condition of purchase. Message frequency varies. Message and data rates may apply. Reply STOP to cancel or HELP for help. See <a href="/sms-policy.html" target="_blank" rel="noopener noreferrer">SMS Terms</a> and <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
```

## homepage-newsletter-2026-10-07-v1

- Date: 2026-10-07
- Forms: `homepage-newsletter`
- Pages:
  - `index.html`

### consent

```html
I agree to receive email newsletters from Lakeland Health Insurance with general health insurance and Medicare education tips. This is not consent to sales calls, texts, or Medicare plan marketing contact. Unsubscribe anytime.
```

## newsletter-signup-2026-10-07-v1

- Date: 2026-10-07
- Forms: `newsletter-signup`
- Pages:
  - `newsletter/index.html`

### consent

```html
I agree to receive email newsletters from Lakeland Health Insurance with general health insurance and Medicare education tips. Optional phone is for newsletter context only, not consent to sales calls or texts. Unsubscribe anytime.
```

## site-aca-2026-10-v1

- Date: 2026-10-14
- Forms: `site-aca-lead`
- Pages:
  - `index.html`
  - `tampa-health-insurance/index.html`

### consent

```html
By checking this box, I give my prior express written consent for Lakeland Health Insurance (David Huff, licensed insurance agent) to contact me about my insurance request, including marketing calls and text messages, at the phone number I provided, which may be sent using an automated system for the selection or dialing of telephone numbers. Consent is not a condition of purchase. Message frequency varies. Message and data rates may apply. Reply STOP to cancel or HELP for help. See <a href="/sms-policy.html" target="_blank" rel="noopener noreferrer">SMS Terms</a> and <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
```

## site-medicare-2026-10-v1

- Date: 2026-10-14
- Forms: `site-medicare-lead`
- Pages:
  - `medicare-broker-lakeland-fl/index.html`

### consent

```html
By checking this box, I give my prior express written consent for Lakeland Health Insurance (David Huff, licensed insurance agent) to contact me about my Medicare request, including marketing calls and text messages, at the phone number I provided, which may be sent using an automated system for the selection or dialing of telephone numbers. Consent is not a condition of purchase. Message frequency varies. Message and data rates may apply. Reply STOP to cancel or HELP for help. See <a href="/sms-policy.html" target="_blank" rel="noopener noreferrer">SMS Terms</a> and <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
```

## none

- Date: 2026-09-29
- Status: superseded
- Forms: legacy city `*-health-insurance` leads (replaced by `site-aca-lead` on 2026-10-14)
- Stored fields: `consent_sms=no`, `consent_text_version=none`, `consent_version_source=none`
