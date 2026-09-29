# Consent text versions

Recorded 2026-09-29. Each `html` block is copied verbatim from the live form markup. `tests/consent-versions.test.mjs` asserts that these strings still appear in the listed pages so the stored version cannot drift from the wording the visitor saw.

`none` is not an allowlisted client version. City `*-health-insurance` forms collect no SMS consent, so the lead function stores `consent_sms=no`, `consent_text_version=none`, and `consent_version_source=none`.

## get-help-2026-07-30-v1

- Date: 2026-07-30
- Forms: `get-help` sitelink radio forms
- Pages:
  - `blog/index.html`
  - `carriers/index.html`
  - `dental-vision/index.html`
  - `medicare/index.html`
  - `plans/index.html`
  - `private-medical-insurance/index.html`
  - `supplemental-insurance/index.html`

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
- Forms: `/get-help/` intake
- Pages:
  - `get-help/index.html`

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

### marketing_email

```html
Optional: send me ongoing educational and marketing emails. This is separate from responding to my request and uses confirmed opt-in. I can unsubscribe at any time.
```

## lp-aca-2026-09-29-v1

- Date: 2026-09-29
- Forms: `lp-aca-lead`
- Pages:
  - `lp/aca/index.html`

### consent

```html
By checking this box, I agree to receive calls and texts from Lakeland Health Insurance about my insurance request at the number provided. Consent is not a condition of purchase. Message frequency varies. Message and data rates may apply. Reply STOP to cancel or HELP for help.
```

## lp-medicare-2026-09-29-v1

- Date: 2026-09-29
- Forms: `lp-medicare-lead`
- Pages:
  - `lp/medicare/index.html`

### consent

```html
By checking this box, I agree to receive calls and texts from Lakeland Health Insurance about my Medicare request at the number provided. Consent is not a condition of purchase. Message frequency varies. Message and data rates may apply. Reply STOP to cancel or HELP for help.
```

## lp-gap-2026-09-29-v1

- Date: 2026-09-29
- Forms: `lp-gap-lead`
- Pages:
  - `lp/gap/index.html`

### consent

```html
By checking this box, I agree to receive calls, texts, and emails from Lakeland Health Insurance about my insurance request at the contact information provided. Consent is not a condition of purchase. Message frequency varies. Message and data rates may apply. Reply STOP to cancel or HELP for help.
```

## none

- Date: 2026-09-29
- Forms: city `*-health-insurance` leads
- Stored fields: `consent_sms=no`, `consent_text_version=none`, `consent_version_source=none`
- Pages:
  - `brandon-health-insurance/index.html`
  - `clearwater-health-insurance/index.html`
  - `davenport-health-insurance/index.html`
  - `haines-city-health-insurance/index.html`
  - `lake-alfred-health-insurance/index.html`
  - `largo-health-insurance/index.html`
  - `new-port-richey-health-insurance/index.html`
  - `riverview-health-insurance/index.html`
  - `st-petersburg-health-insurance/index.html`
  - `tampa-health-insurance/index.html`
  - `wesley-chapel-health-insurance/index.html`
  - `winter-haven-health-insurance/index.html`

These pages have no SMS checkbox and no TCPA consent label. Do not add one without a separate compliance review.
