## PWA Icons

Branded headshot favicons cropped from `/assets/images/david-huff-blue-polo.jpg`:

- `icon-192.png` — 192x192 (PWA + Google SERP site icon)
- `icon-512.png` — 512x512 (PWA splash screen, Apple touch high-res)
- `icon-maskable-512.png` — 512x512, circular face inset on navy `#1B2A4A`, safe-zone padded for Android adaptive icons

To regenerate from a new square source photo:

```bash
sips -s format png -z 512 512 assets/images/david-huff-blue-polo.jpg --out icons/icon-512.png
sips -s format png -z 192 192 assets/images/david-huff-blue-polo.jpg --out icons/icon-192.png
sips -s format png -z 512 512 assets/images/david-huff-blue-polo.jpg --out icons/icon-maskable-512.png
sips -s format ico -z 48 48 assets/images/david-huff-blue-polo.jpg --out favicon.ico
```
