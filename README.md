# Hangr

**A privacy-first wardrobe tracker.** Photograph clothes once, log when you wear them, see what you actually reach for.

All data lives in your browser. No cloud, no telemetry, no account.

> Live: **[derajyojith.dev/Hangr](https://derajyojith.dev/Hangr)**

---

## What it does

**Logging is one tap.** Open Hangr, tap the items you wore today, done. Saved outfits collapse a regular combo (say, "Friday casual") into a single tap.

**Capture happens on-device.** Snap a photo, the background gets removed in your browser via a quantized RMBG-1.4 model, CLIP picks the category and a JS palette extractor picks the color. The form is pre-filled. Save.

**Insights tell the truth.** Cost-per-wear, total spent, the items you bought 90 days ago and never wore (buyer's regret), the items you haven't touched in 6 months but paid real money for (worth letting go?), the combos you used to wear together but haven't in months (forgotten pairs), the colours you actually reach for vs the ones you own.

**Shopping conscience.** A `/wants` list with an inline inventory check — add a "considering buying" item, see how many similar pieces you already own, their average cost-per-wear, how many are dormant. The pause before purchase is the feature.

**Visual duplicate detection.** Each item gets a CLIP embedding stored locally. New captures are compared against existing items at cosine ≥ 0.88 — "you may already own this — looks similar to *Navy Linen Shirt*." Doesn't block the save; just makes you think twice.

**Year in clothes.** End-of-year recap rendered as a single 1080×1920 PNG: most-worn item with photo, top colour, total wears, average ₹/wear, items added, dormant count. Generated client-side; nothing leaves the device unless you share the image.

**Indian context first.** Currency is ₹ throughout. Categories include *Ethnic* (Kurta, Saree, Salwar, Sherwani). Occasion tags include *Festive* and *Wedding* as first-class citizens. Date format is en-IN.

---

## Privacy model

This is the core architectural commitment, not marketing copy.

- **Photos** are stored as `Blob`s in IndexedDB on your device. Never uploaded.
- **ML models** (RMBG-1.4 for background removal, CLIP-base for category + image embeddings) run in your browser via WebGPU/WASM. Photos never leave the device for inference.
- **Analytics** — none. No third-party scripts. Open the network tab; you'll see only your own assets and one model download from `huggingface.co` on first use.
- **Backend** — there isn't one. Hangr is a static SPA + your browser + IndexedDB.

If cloud sync is ever added, it will be opt-in and end-to-end encrypted. The default will always be device-only.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | React 18 + TypeScript (strict mode) |
| Bundler | Vite 5 |
| Styling | Tailwind CSS — Fraunces (display) + Inter (body), surface tokens, hairline borders, dark mode only |
| Local DB | Dexie (IndexedDB) — items, photos, wears, outfits, day notes, wants, embeddings |
| State | Zustand for UI, TanStack Query for stray async, `dexie-react-hooks` for live data |
| PWA | vite-plugin-pwa + Workbox; offline-capable, install-to-home-screen |
| In-browser ML | `@huggingface/transformers` v3 — RMBG-1.4 + CLIP-base |
| Routing | react-router-dom v6 |
| Icons | lucide-react |

---

## Getting started

```bash
npm install

# One-time: regenerate PWA icons from public/icon.png
npm run generate-pwa-assets

# Dev server (also exposed on LAN so you can test on your phone)
npm run dev
```

`http://localhost:5173` on your laptop, or the LAN URL Vite prints (e.g. `http://192.168.x.x:5173`) on your phone.

> **First-time background removal** downloads a ~150 MB model from Hugging Face. Subsequent runs are instant — the model is cached in IndexedDB by transformers.js.
>
> **iOS note** — On-device ML defaults OFF on iOS because RMBG (~150 MB) + CLIP (~80 MB) can push older iPhones close to Safari's tab-memory limit. Toggle it on in Settings if your device handles it.

### Build

```bash
npm run build       # tsc -b && vite build && copy 404.html
npm run preview     # preview the production build locally
```

### Install on your phone

- **iOS**: open the deployed URL in Safari → Share → *Add to Home Screen*.
- **Android**: open in Chrome → *Install app* in the menu, or tap the install banner.

After install, Hangr launches fullscreen.

---

## Project structure

```
Hangr/
├── public/                       # static assets, PWA icons, _redirects
├── scripts/
│   └── copy-404.mjs              # postbuild: dist/404.html for SPA fallback
├── src/
│   ├── components/               # Sheets, cards, primitives
│   │   ├── CalendarBackdateSheet.tsx
│   │   ├── DayNoteSheet.tsx
│   │   ├── ItemPairRow.tsx
│   │   ├── OutfitChip / OutfitDetailSheet / OutfitEditorSheet
│   │   ├── Sheet.tsx             # bottom-sheet primitive (calls useOverlay → fades TabBar)
│   │   ├── TabBar.tsx            # floating capsule, 4 tabs + centred Add FAB
│   │   ├── WantEditorSheet.tsx
│   │   └── WearTrendChart.tsx    # tap-to-reveal weekly chart with average line
│   ├── db/                       # Dexie helpers — go through these, not db.<table>
│   │   ├── dexie.ts              # schema (v7), all interfaces
│   │   ├── items.ts / itemPhotos
│   │   ├── wears.ts              # logWear, logSavedOutfit, listRecentWearDays
│   │   ├── outfits.ts            # saved outfits CRUD
│   │   ├── dayNotes.ts           # per-day diary notes
│   │   └── wants.ts              # want list
│   ├── lib/
│   │   ├── analytics.ts          # buyersRegret, dormantItems, topWornColors, computeDormantPairs, inventoryForCategory
│   │   ├── bgRemoval.ts          # transformers.js + RMBG-1.4 (forces WASM on iOS)
│   │   ├── detection.ts          # CLIP zero-shot category + JS palette extractor
│   │   ├── embeddings.ts         # CLIP image-feature extraction + cosine similarity
│   │   ├── colors.ts             # color name → hex (named + hash fallback)
│   │   ├── occasions.ts          # OCCASIONS const
│   │   ├── shell.ts              # useShell + useOverlay hook
│   │   ├── wrapped.ts            # year-in-clothes PNG renderer (Canvas 2D)
│   │   └── ...
│   ├── routes/
│   │   ├── Capture.tsx           # photo → bg removal → detection → duplicate check → save
│   │   ├── BulkCapture.tsx       # gallery batch (up to 30), sequential ML, save together
│   │   ├── Closet.tsx            # 2-col grid, category + occasion filters, want-list link
│   │   ├── Log.tsx               # yesterday prompt, today's outfit, saved outfits, recent days
│   │   ├── Insights.tsx          # honesty report
│   │   ├── ItemDetail.tsx        # wear stats, edit, archive, replace photo, history
│   │   ├── Settings.tsx          # privacy, ML toggle, storage, Wrapped, export, delete-all
│   │   └── Wants.tsx             # pre-purchase consideration with inventory cross-check
│   └── main.tsx
├── .github/workflows/main.yml    # GitHub Pages deploy (build → upload-artifact → deploy-pages)
├── vite.config.ts                # PROD_BASE = '/Hangr/' for subpath builds
├── tailwind.config.js            # surface tokens, Fraunces + Inter, rounded-card/sheet
└── package.json
```

---

## Status

**v0.1 → v0.8 done.**

- v0.1–0.5: PWA shell, capture loop with on-device bg removal + auto-detection, closet, item detail, wear logging, insights v1, settings.
- v0.6: bulk capture (gallery batch up to 30 with sequential per-item ML).
- v0.7: saved outfits with one-tap logging.
- v0.8: buyer's regret, donation review, forgotten pairs, worn-colours palette, auto-suggest "save this combo," yesterday backfill prompt, day diary notes, want list with inventory check, occasion tags, calendar-grid backdate, visual duplicate detection, year-in-clothes Wrapped recap.
- Design refresh: editorial dark UI with Fraunces + Inter, surface tokens, floating capsule TabBar with FAB, useOverlay shell pattern.

**Roadmap (not built):**

- Vibe-based outfit suggestions (CLIP embeddings already in place from v0.8)
- Selfie auto-log (mirror selfie → CLIP match → wear logged)
- Gmail receipt import (privacy-first OAuth path; deferred)
- HEIC handling improvements
- Code-split transformers.js (currently in main bundle)
- Optional cloud sync with E2E encryption (only if explicitly requested)

**Not viable**

- Daily push notifications. Real scheduled push needs a backend (VAPID), which violates the privacy moat. The in-app "Yesterday's outfit?" prompt covers the same job-to-be-done when the user opens the app.

---

## Deployment

The `main` branch auto-deploys to GitHub Pages via [`.github/workflows/main.yml`](.github/workflows/main.yml) — `npm ci → npm run build → upload-pages-artifact → deploy-pages@v4`.

The build is subpath-aware (`base: '/Hangr/'` set in [vite.config.ts](vite.config.ts)) so the same artifact serves cleanly under `<custom-domain>/Hangr/`. SPA deep links work because [`scripts/copy-404.mjs`](scripts/copy-404.mjs) duplicates `index.html` into `404.html` for GH Pages' fallback.

If you fork and want your own deploy: set `PROD_BASE` in [`vite.config.ts`](vite.config.ts) to `/<your-repo-name>/`, enable Pages on your repo with **Source = GitHub Actions**, and push to `main`. Custom-domain users on a User Pages parent shouldn't set the project's custom-domain field — leave it blank and your project inherits `<custom-domain>/<repo-name>/` automatically.

---

## Author

Built by [Deraj](https://derajyojith.dev). Hangr is part of the same opinionated-personal-tools family as Ledgr (privacy-first finance for Indian banks) and Basho (map-based trip planner) — same flavour of "I want this in my life" software.

---

## License

[MIT](LICENSE) — fork it, build on it, ship your own. If you do something cool with it, I'd love to see it (open an issue or ping me).
