# Hangr — context for a new agent

This file primes a fresh Claude / Cursor / Copilot chat with everything it needs
to be productive on Hangr without re-deriving decisions from scratch.

> The user is **Deraj**. He prefers polished dark UIs, Indian context, privacy-first
> architecture, and feature decisions driven by real usage signal — not premature
> design. Be opinionated, be brief, push back if a request will paint you into a
> corner. Don't add features he didn't ask for. Don't refactor "for cleanliness"
> without permission.

---

## What Hangr is

A **privacy-first wardrobe tracker**, deployed as a PWA. Users photograph items,
log when they wear them, and the app reports cost-per-wear, dormant items, and
honesty-style insights. All data lives in IndexedDB on the device — no backend,
no telemetry, no account.

Repo: https://github.com/OneAutumnLeef/Hangr
Production: deployed via Vercel from `main`. URL in user's Vercel dashboard.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Bundler | **Vite 5** | Fast HMR, ESM-first, no SSR overhead |
| Framework | **React 18 + TypeScript (strict)** | `noUnusedLocals` and `noUnusedParameters` are ON |
| Styling | **Tailwind CSS** | Dark theme. Lime (`#a3e635`) accent on near-black (`ink-950 = #050505`) |
| State (UI) | **Zustand** + persist | Toast queue, preferences |
| State (server) | **TanStack Query** | Used sparingly — Dexie's `useLiveQuery` handles most reactive reads |
| Local DB | **Dexie (IndexedDB)** | Items, item photos (Blobs), wears |
| PWA | **vite-plugin-pwa** + Workbox | `skipWaiting + clientsClaim` so new builds activate immediately |
| In-browser ML | **@huggingface/transformers v3** | RMBG-1.4 (bg removal), CLIP-base (zero-shot category) |
| Routing | **react-router-dom v6** | Tab-bar shell, all routes inside `<Layout>` |
| Icons | **lucide-react** | Consistent stroke-based iconography |

**Don't reach for:** Next.js (SSR is wasted overhead here), Redux (Zustand is
lighter and has been enough), React Query for everything (Dexie's live queries
are better for local data), styled-components (Tailwind is the choice).

---

## Project layout

```
Hangr/
├── public/
│   └── icon.svg                 # Source for all PWA icons (generated via npm run generate-pwa-assets)
├── src/
│   ├── components/
│   │   ├── ArchiveDialog.tsx    # Reason picker when archiving an item
│   │   ├── CategoryFilter.tsx   # Horizontal scrollable chip row
│   │   ├── DiagnosticsView.tsx  # Settings → Diagnostics log feed
│   │   ├── EmptyState.tsx
│   │   ├── ErrorBoundary.tsx    # App-wide; surfaces errors instead of blank screen
│   │   ├── HangerIcon.tsx       # Wordmark glyph
│   │   ├── InstallPrompt.tsx    # Cross-platform A2HS prompt
│   │   ├── ItemCard.tsx         # Closet grid card
│   │   ├── ItemForm.tsx         # Capture + edit. Includes "Already owned" pre-owned section
│   │   ├── ItemPickerSheet.tsx  # Multi-select item picker (used by Log)
│   │   ├── ItemRowMini.tsx      # Insights leaderboard row
│   │   ├── Layout.tsx           # Tab-bar shell; safe-area top padding
│   │   ├── MiniItemThumb.tsx    # Small square photo
│   │   ├── Sheet.tsx            # Bottom-sheet primitive
│   │   ├── StatTile.tsx
│   │   ├── TabBar.tsx           # 5 tabs: Closet, Add, Log, Insights, Settings
│   │   ├── Toaster.tsx
│   │   └── WearTrendChart.tsx   # Dependency-free SVG bar chart (12-week)
│   ├── db/
│   │   ├── dexie.ts             # Schema (v2). Item, ItemPhoto, Wear interfaces
│   │   ├── items.ts             # Item CRUD + photo helpers
│   │   └── wears.ts             # Wear logging, queries, aggregations
│   ├── lib/
│   │   ├── analytics.ts         # loadAllAnalytics() — single-pass aggregation. Includes seedWearCount in totals
│   │   ├── bgRemoval.ts         # transformers.js + RMBG-1.4. Forces WASM on iOS
│   │   ├── dataExport.ts        # JSON export, deleteAll, storage estimate
│   │   ├── dates.ts             # startOfDay etc.
│   │   ├── detection.ts         # CLIP zero-shot category + JS-only color extractor
│   │   ├── diagnostics.ts       # In-app logger. Patches console + window error events. Persists to localStorage
│   │   ├── photo.ts             # processPhoto() resizes to 1600px JPEG, returns Blob + url
│   │   ├── preferences.ts       # Zustand persist store. mlEnabled toggle. Exports `isIOS`
│   │   ├── toast.ts             # toast.success/error/info
│   │   └── utils.ts             # cn(), makeId()
│   ├── routes/
│   │   ├── Capture.tsx          # Photo → bg removal → detection → form → save
│   │   ├── Closet.tsx           # Grid + category filter
│   │   ├── Insights.tsx         # Honesty report — stats, trend, leaderboards, dormant
│   │   ├── ItemDetail.tsx       # Read view + edit mode + wear stats + wear history + backdate UI
│   │   ├── Log.tsx              # Today's outfit + recent days
│   │   └── Settings.tsx         # Privacy, ML toggle, storage, data export, delete-all, diagnostics, about
│   ├── App.tsx
│   ├── main.tsx                 # installDiagnostics() runs before render
│   ├── index.css                # @tailwind + form-input component class
│   └── vite-env.d.ts            # __BUILD_TIME__ declaration
├── vite.config.ts               # vite-plugin-pwa, COOP/COEP dev headers, __BUILD_TIME__ define
├── pwa-assets.config.ts         # PWA icon generator config
├── vercel.json                  # COOP: same-origin / COEP: credentialless headers
├── tailwind.config.js           # ink + accent (lime) color palettes
├── tsconfig.{app,node}.json     # strict, noUnusedLocals, noUnusedParameters
└── package.json
```

---

## Data model (Dexie v2)

```ts
// src/db/dexie.ts

interface Item {
  id: string
  name: string
  category?: string            // 'Top' | 'Bottom' | 'Outerwear' | 'Shoes' | 'Dress' | 'Ethnic' | 'Accessory' | 'Innerwear' | 'Other'
  color?: string
  brand?: string
  primaryPhotoId?: string       // FK → ItemPhoto.id
  purchasePriceMinor?: number   // paise (₹100 = 10000)
  purchasedAt?: number          // unix ms
  source?: 'manual' | 'gmail' | 'ledgr'
  createdAt: number
  archivedAt?: number
  archivedReason?: ArchivedReason
  archivedNote?: string

  // Pre-owned baseline — counts past wears toward stats
  seedWearCount?: number
  seedAsOf?: number             // when those seed wears began
}

interface ItemPhoto {
  id: string
  itemId: string
  blob: Blob
  width: number
  height: number
  isProcessed: boolean          // true = bg removed (PNG with alpha)
  createdAt: number
}

interface Wear {
  id: string
  itemId: string
  wornAt: number                // start-of-day ms in user's local TZ
  source: 'manual' | 'selfie' | 'inferred' | 'backdated'
  outfitId?: string
  createdAt: number
}
```

**Always go through helpers** in `src/db/items.ts` and `src/db/wears.ts`. Don't
poke `db.items` directly from components.

---

## Architectural commitments (don't violate without explicit user buy-in)

1. **Photos and wears stay on device.** No upload, no cloud sync (without
   opt-in encryption — and that doesn't exist yet).
2. **ML runs in-browser.** transformers.js + IndexedDB cache. Never POST a
   photo to a server.
3. **No analytics, no telemetry.** Inspect Network tab → only own assets +
   one model download from huggingface.co.
4. **Indian context first.** Currency is ₹ throughout. Categories include
   ethnic wear (Kurta, Saree, Salwar, Sherwani). Date locales use `en-IN`.
5. **Local-first analytics.** All Insights computed on the client from full
   table scans. No memoization yet — fine until wardrobes grow past ~10k items.
6. **TypeScript strict.** `noUnusedLocals` and `noUnusedParameters` are ON.
   Vercel build fails on dead vars. Cast to `any` only when interacting with
   transformers.js's loose typings.

---

## Status (as of last session)

**Completed: v0.1 → v0.5 + extras.**

- ✅ PWA shell, install prompt, offline-capable
- ✅ Capture: photo → bg removal (RMBG-1.4) → auto-detect category (CLIP) + color → form → save
- ✅ Closet grid + category filter + item detail (edit / archive with reason / replace photo)
- ✅ Pre-owned items: seedWearCount + seedAsOf, integrated into analytics
- ✅ Backdate wear (date picker on item detail)
- ✅ Wear logging: Today's outfit, recent days, item picker sheet
- ✅ Insights: stats, 12-week trend chart, most-worn / best-CPW / worst-CPW / dormant / by-category
- ✅ Settings: privacy info, ML toggle, storage usage, JSON export, delete-all, build timestamp, diagnostics feed
- ✅ Toast system, error boundary, in-app diagnostic logger
- ✅ iOS-specific: ML toggle defaults OFF on iOS, force WASM device (WebGPU on iOS Safari 18 crashes silently)

**Roadmap (not built):**

- ⏳ v0.6 — Bulk capture (queue gallery picker), or Gmail receipt import, or saved outfits — tbd by user signal
- ⏳ v0.7 — Vibe-based outfit suggestions (CLIP embeddings on items, ranking by vibe prompt)
- ⏳ v0.8 — Selfie auto-log (mirror selfie → CLIP match → log wear)
- ⏳ HEIC handling improvements (iOS gallery delivers HEIC; canvas decode is brittle)
- ⏳ Code-split transformers.js (currently in main bundle)
- ⏳ Optional cloud sync with E2E encryption (only if user explicitly wants it)

---

## Known quirks

| Quirk | Where | Why |
|---|---|---|
| WASM forced on iOS | `lib/bgRemoval.ts`, `lib/detection.ts` | iOS Safari 18 WebGPU crashes RMBG silently. Diagnostic logs in `lib/diagnostics.ts` confirmed silent reload to `/closet` |
| `crossOriginIsolated: false` in production | `vercel.json` headers not taking effect | Vercel CDN may strip; iOS Safari may reject `credentialless`. Single-threaded WASM works regardless. Worth investigating later |
| ML toggle defaults OFF on iOS | `lib/preferences.ts` `isIOS` initial value | RMBG (~150MB) + CLIP (~80MB) is fine on 8GB iPhones, but older iPhones could OOM. User can flip on |
| Service worker `skipWaiting + clientsClaim` | `vite.config.ts` workbox | New builds activate immediately. Critical because iOS SWs cache aggressively |
| `__BUILD_TIME__` stamped at build | `vite.config.ts` define + `Settings → About` | Lets users verify which build they're on |
| TypeScript loose around transformers.js | `lib/bgRemoval.ts`, `lib/detection.ts` | API surface is `any`-typed in places. Cast `Promise<unknown>` through `withTimeout` to keep TS strict happy |

---

## Common dev commands

```bash
npm install
npm run generate-pwa-assets       # Once after icon.svg changes
npm run dev                       # http://localhost:5173 (also LAN-exposed)
npm run build                     # tsc -b && vite build — must pass before pushing
npm run preview                   # Preview production build locally
```

**Before pushing:** `npm run build` locally. Vercel build fails on any TS
error. Common offenders: unused imports (TS6133), `any`-typed values flowing
into generic functions and inferring as `unknown`.

---

## Deployment

- Vercel auto-deploys on push to `main`.
- COOP/COEP set in `vercel.json` (currently not honored by some clients —
  doesn't block functionality).
- Settings → About shows `build: <ISO timestamp>` — use this to verify a
  device is running the latest bundle.

---

## Debugging on iOS

The in-app diagnostic logger (`lib/diagnostics.ts` + Settings → Diagnostics) is
the primary debug tool. It captures:

- All `console.{log,info,warn,error}`
- `window.onerror`
- `window.onunhandledrejection`
- Environment fingerprint on every install (UA, WebGPU/SharedArrayBuffer
  availability, `crossOriginIsolated`, storage quota)

Logs persist to localStorage so they survive page reloads. User flow:

1. Settings → Diagnostics → trash icon (clear).
2. Reproduce the bug.
3. Settings → Diagnostics → "Errors only" filter → Copy.
4. Paste into chat.

If the diagnostic feed shows no errors but the bug clearly happened, the
failure is below the JS layer (native WASM crash, WebGPU compile error,
WebKit memory event). Next step is BrowserStack Live with real iOS Safari
devtools or a Mac + USB iPhone + Safari Web Inspector.

---

## How Deraj works

- Doesn't ask for code unless he wants code. Conversational ideation comes first.
- Wants to ship — favors building the smallest thing that makes a feature real,
  then iterating on real friction.
- Has shipped two web apps before Hangr: **Ledgr** (privacy-first finance
  tracker for Indian banks) and **Basho** (map-based trip planner). Hangr is
  in the same family — opinionated, polished, "I want this in my life" tools.
- Trust Deraj's instincts on UX. Push back on technical decisions when there's
  a real reason.

---

## Things to NOT do without explicit permission

- Add a backend / database / API. Privacy is the moat.
- Refactor file structure for "cleanliness."
- Switch CSS frameworks, state managers, or routers.
- Build features that aren't on the roadmap or weren't requested.
- Ship raw user data anywhere off-device.
- Add analytics, tracking, A/B testing, "for performance reasons."
- Use `any` casually. The strict TypeScript is intentional.

---

## When in doubt

Read `README.md` for user-facing setup, this file for architectural context,
and the actual code — file headers in `src/lib/*` and `src/db/*` document the
"why" behind each module's shape. If something feels off, ask Deraj before
changing it.
