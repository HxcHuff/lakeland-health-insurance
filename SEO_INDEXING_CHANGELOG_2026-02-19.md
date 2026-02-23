# SEO and Indexing Change Log

Date: 2026-02-19
Project: lakeland-health-insurance

## Summary
Implemented crawl/indexing and metadata fixes to remove conflicting signals, resolve broken social metadata assets, and reduce duplicate SEO metadata.

## Changes Made

1. Removed `thanks.html` from sitemap to avoid indexing conflict
- File: `sitemap.xml`
- Removed URL entry for `https://lakelandhealthinsurance.com/thanks.html`
- Reason: page is intentionally non-indexable (`noindex`) and disallowed in `robots.txt`.

2. Blocked snippet fragment from crawler discovery
- File: `robots.txt`
- Added: `Disallow: /health-protector-guard/nav-snippet.html`
- Reason: this file is a reusable HTML fragment, not a standalone indexable page.

3. Fixed missing Open Graph/Twitter image assets and OG URL mismatch
- File: `blog/florida-insurance-guide.html`
  - Updated `og:image` and `twitter:image` to existing asset:
    - `https://lakelandhealthinsurance.com/assets/lakeland-downtown-professional-district.jpg`
  - Updated `og:url` to canonical `.html` URL.

- File: `blog/how-to-read-insurance-card.html`
  - Updated `og:image` and `twitter:image` to existing asset:
    - `https://lakelandhealthinsurance.com/david_the_dude2.jpg`
  - Updated `og:url` to canonical `.html` URL.

- File: `blog/lakeland-regional-watson-clinic-insurance-2026.html`
  - Updated `og:image` and `twitter:image` to existing asset:
    - `https://lakelandhealthinsurance.com/assets/lakeland-regional-health-facility.jpg`
  - Updated `og:url` to canonical `.html` URL.

4. Reduced duplicate metadata between short-term articles
- File: `blog/short-term-health-insurance-guide.html`
- Updated JSON-LD `headline` and `description`
- Updated `<title>` and `<meta name="description">`
- Updated `og:title`, `og:description`, `twitter:title`, `twitter:description`
- Reason: avoid title/description duplication with `blog/short-term-medical-guide.html`.

5. Added missing meta description and fixed heading hierarchy
- File: `download-free-guide-here.html`
- Added missing `<meta name="description">`
- Kept main page heading as `<h1>`
- Changed section headings from `<h1>` to `<h2>` for semantic structure:
  - Mistake #1 through Mistake #5
  - Your Action Plan
  - The Bottom Line

## Validation Performed
- Confirmed sitemap no longer includes `thanks.html`.
- Confirmed all updated OG/Twitter image targets exist on disk.
- Confirmed three OG URL mismatches now match canonical `.html` URLs.
- Confirmed no remaining missing metadata on indexable page `download-free-guide-here.html`.
- Confirmed `download-free-guide-here.html` now has a single `<h1>`.

## Notes
- `test.html`, `offline.html`, `thanks.html`, and `404.html` remain intentionally non-indexed.
- No content/body copy was rewritten beyond SEO metadata and heading-level normalization.
