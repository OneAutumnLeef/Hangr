# Hangr

A privacy-first wardrobe tracker. Photograph clothes once, see what you actually wear.

All data stays on your device. No cloud, no telemetry, no account.

---

## What you can do today (v0.5 MVP)

- **Capture** — take a photo or pick from gallery → background removal runs in your browser → fill the form → save.
- **Closet** — grid of all your items, filter by category.
- **Item detail** — wear stats (count, last worn, cost-per-wear), edit, archive, replace photo, full wear history.
- **Log** — log today's outfit, see recent days at a glance.
- **Insights** — total spent, total wears, weekly trend chart, most-worn, best/worst cost-per-wear, dormant items, by-category breakdown.
- **Settings** — privacy info, storage usage, export everything as JSON, delete all data.

## Stack

- **Vite + React + TypeScript** — fast HMR, ESM-first, no SSR overhead
- **Tailwind CSS** — utility styling, dark theme
- **Dexie (IndexedDB)** — local data layer for items, photos, wears
- **vite-plugin-pwa** — manifest, service worker, offline shell, install prompt
- **Zustand** — toast store + (future) UI state
- **TanStack Query** — async state for non-Dexie reads
- **Lucide React** — icons
- **@huggingface/transformers (transformers.js v3)** — in-browser ML; runs RMBG-1.4 on WebGPU/WASM for background removal

## Getting started

```bash
npm install

# One-time: generates pwa-192x192.png, pwa-512x512.png, maskable, apple-touch, favicon
# from public/icon.png
npm run generate-pwa-assets

# Dev server (also exposed on LAN so you can open it on your phone)
npm run dev
```

Open `http://localhost:5173` on your laptop, or the LAN URL Vite prints (e.g. `http://192.168.x.x:5173`) on your phone.

> **First-time background removal** downloads a ~150MB model from Hugging Face. Subsequent runs are instant — the model is cached in IndexedDB by transformers.js.

## Build

```bash
npm run build
npm run preview
```

## Install on your phone

1. **Deploy first** — service workers + install only work on HTTPS (or localhost). Push to GitHub → import on Vercel / Netlify / Cloudflare Pages — all free, all auto-detect Vite.
2. **iOS**: open the deployed URL in Safari → tap **Share** → **Add to Home Screen**.
3. **Android**: open in Chrome → tap the install banner, or menu → **Install app**.

After install Hangr launches fullscreen with no browser chrome.

> **Production note** — for some ONNX backends to use SharedArrayBuffer (faster ML inference), you need the deployed origin to send `Cross-Origin-Embedder-Policy: credentialless` and `Cross-Origin-Opener-Policy: same-origin` headers. Hangr works without these (falls back to single-threaded WASM); they're a performance bonus. On Vercel, add a `vercel.json` with these headers if you want them.

## Privacy model

This is the core architectural commitment, not marketing copy:

- **Photos** are stored as Blobs in IndexedDB on your device. Never uploaded.
- **ML models** (RMBG-1.4 today, more later) run in your browser via WebGPU/WASM. Photos never leave the device for inference.
- **Analytics** — none. No third-party scripts. Inspect the network tab; you'll see only your own assets and one model download from `huggingface.co`.
- **Backend** — there isn't one. Hangr is a static site + your browser + IndexedDB.

Cloud sync, if ever added, will be opt-in and end-to-end encrypted. The default will always be device-only.

## Project structure

```
Hangr/
├── public/
│   └── icon.png                 # master icon — generates all PWA sizes
├── src/
│   ├── components/
│   │   ├── CategoryFilter.tsx
│   │   ├── EmptyState.tsx
│   │   ├── HangerIcon.tsx
│   │   ├── InstallPrompt.tsx    # cross-platform A2HS prompt
│   │   ├── ItemCard.tsx
│   │   ├── ItemForm.tsx
│   │   ├── ItemPickerSheet.tsx  # multi-select sheet for outfit logging
│   │   ├── ItemRowMini.tsx      # row in leaderboards
│   │   ├── Layout.tsx           # tab-bar shell
│   │   ├── MiniItemThumb.tsx
│   │   ├── Sheet.tsx            # bottom sheet primitive
│   │   ├── StatTile.tsx
│   │   ├── TabBar.tsx
│   │   ├── Toaster.tsx
│   │   └── WearTrendChart.tsx   # dependency-free bar chart
│   ├── db/
│   │   ├── dexie.ts             # schema (items, itemPhotos, wears)
│   │   ├── items.ts             # item CRUD helpers
│   │   └── wears.ts             # wear logging + queries
│   ├── lib/
│   │   ├── analytics.ts         # insights computation
│   │   ├── bgRemoval.ts         # transformers.js + RMBG-1.4
│   │   ├── dataExport.ts        # JSON export, delete-all, storage estimate
│   │   ├── dates.ts
│   │   ├── photo.ts             # resize / encode
│   │   ├── toast.ts             # zustand toast store
│   │   └── utils.ts
│   ├── routes/
│   │   ├── Capture.tsx
│   │   ├── Closet.tsx
│   │   ├── Insights.tsx
│   │   ├── ItemDetail.tsx
│   │   ├── Log.tsx
│   │   └── Settings.tsx
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── index.html
├── vite.config.ts
├── pwa-assets.config.ts
├── tailwind.config.js
└── package.json
```

## Roadmap

- [x] **v0.1 — Walking skeleton.** Installable PWA, empty Dexie schema, branded landing.
- [x] **v0.2 — Capture loop.** Camera/gallery, background removal (RMBG-1.4), save item, item detail (read-only), edit, archive, replace photo, category filter.
- [x] **v0.3 — Wear logging.** "I wore this today" CTA, today's outfit, item picker sheet, recent days list, full wear history per item.
- [x] **v0.4 — Honesty report.** Total stats, weekly wear trend, most-worn, best/worst CPW, dormant items, by-category breakdown.
- [x] **v0.5 — MVP.** Settings (privacy + storage + export + delete-all), toast system, polish.
- [ ] **v0.6 — Gmail receipt import.** Auto-populate closet from Myntra / Ajio / Amazon Fashion.
- [ ] **v0.7 — Vibe-based outfit suggestions.** From owned items, with weather + occasion context.
- [ ] **v0.8 — Selfie auto-log.** Mirror selfie → CLIP match → wear logged.
- [ ] **v1.0 — Public.**

## License

TBD — private during build-out.
