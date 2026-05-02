## PWA Icons

Branded headshot favicons cropped from `david_the_dude2.jpg`:

- `icon-192.png` — 192x192 (PWA + Google SERP site icon)
- `icon-512.png` — 512x512 (PWA splash screen, Apple touch high-res)
- `icon-maskable-512.png` — 512x512, circular face inset on navy `#1B2A4A`, safe-zone padded for Android adaptive icons

To regenerate from a new source photo, run `python3 /tmp/build_favicons.py` (or recreate the script — it crops a 700x700 face square at center (685, 320) of the source and writes all four files including `/favicon.ico`).
