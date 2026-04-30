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
| Styling | **Tailwind CSS** | Dark theme. Lime (`#a3e635`) accent on near-black (`#050505`). Editorial pairing: **Fraunces** for display headings + italic section heads, **Inter** for body / UI / tabular ₹. Surface tokens: `surface-1` `#0e0e0f`, `surface-2` `#16161a`, `border-hairline` `#26262a`, `text-tertiary` `#6b6b6b`. Custom radii: `rounded-card` (14px), `rounded-sheet` (22px). Legacy `ink-*` scale kept for backward compat — migrate to surface tokens when touching components. |
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
│   └── icon.png                 # Source for all PWA icons (generated via npm run generate-pwa-assets)
├── src/
│   ├── components/
│   │   ├── ArchiveDialog.tsx          # Reason picker when archiving an item
│   │   ├── CalendarBackdateSheet.tsx  # 35-day grid for backdate flow on Log
│   │   ├── CategoryFilter.tsx         # Horizontal scrollable chip row (with `scrollbar-none` utility)
│   │   ├── DayNoteSheet.tsx           # Edit per-day diary note ("Wore to Sneha's wedding")
│   │   ├── DiagnosticsView.tsx        # Settings → Diagnostics log feed
│   │   ├── EmptyState.tsx
│   │   ├── ErrorBoundary.tsx          # App-wide; surfaces errors instead of blank screen
│   │   ├── HangerIcon.tsx             # Wordmark glyph
│   │   ├── InstallPrompt.tsx          # Cross-platform A2HS prompt
│   │   ├── ItemCard.tsx               # Closet grid card
│   │   ├── ItemForm.tsx               # Capture + edit. Pre-owned section + occasion multi-select
│   │   ├── ItemPairRow.tsx            # Insights "Forgotten pairs" row — overlapping thumb pair
│   │   ├── ItemPickerSheet.tsx        # Multi-select item picker (Log)
│   │   ├── ItemRowMini.tsx            # Insights leaderboard row
│   │   ├── Layout.tsx                 # Capsule TabBar shell; safe-area top padding
│   │   ├── MetadataPill.tsx           # ItemDetail metadata 2x2 pill
│   │   ├── MiniItemThumb.tsx          # Small square photo
│   │   ├── OutfitChip.tsx             # Saved-outfit rail card (2x2 grid of thumbs)
│   │   ├── OutfitDetailSheet.tsx      # Outfit preview + Wear today / Edit / Delete
│   │   ├── OutfitEditorSheet.tsx      # Create/edit outfit (name + multi-select grid)
│   │   ├── Sheet.tsx                  # Bottom-sheet primitive — calls useOverlay() to fade TabBar
│   │   ├── StatTile.tsx
│   │   ├── TabBar.tsx                 # Floating capsule pill: 4 tabs (Closet/Log/Insights/Settings) + centred Add FAB; fades when overlayCount > 0
│   │   ├── Toaster.tsx
│   │   ├── WantEditorSheet.tsx        # Add/edit a "considering buying" item with live inventory cross-check
│   │   └── WearTrendChart.tsx         # Dependency-free SVG bar chart (12-week, tap-to-reveal count, dashed average line)
│   ├── db/
│   │   ├── dayNotes.ts          # getDayNote / setDayNote / listDayNotes (per-day diary)
│   │   ├── dexie.ts             # Schema (v7). Item, ItemPhoto, Wear, Outfit, DayNote, Want, ItemEmbedding
│   │   ├── items.ts             # Item CRUD + photo helpers
│   │   ├── outfits.ts           # createOutfit / listOutfits / archiveOutfit / etc.
│   │   ├── wants.ts             # createWant / listWants / decideWant (bought/passed)
│   │   └── wears.ts             # Wear logging, queries, aggregations, logSavedOutfit
│   ├── lib/
│   │   ├── analytics.ts         # loadAllAnalytics() — single-pass aggregation. Includes buyersRegret, topWornColors, dormantPairs, inventoryForCategory
│   │   ├── bgRemoval.ts         # transformers.js + RMBG-1.4. Forces WASM on iOS
│   │   ├── colors.ts            # Color name → hex (named palette + hash fallback)
│   │   ├── dataExport.ts        # JSON export, deleteAll, storage estimate
│   │   ├── dates.ts             # startOfDay etc.
│   │   ├── detection.ts         # CLIP zero-shot category + JS-only color extractor
│   │   ├── diagnostics.ts       # In-app logger. Patches console + window error events. Persists to localStorage
│   │   ├── embeddings.ts        # CLIP image-feature pipeline + cosine similarity for duplicate detection
│   │   ├── occasions.ts         # OCCASIONS const (Casual/Office/Festive/Wedding/Travel/...)
│   │   ├── photo.ts             # processPhoto() resizes to 1600px JPEG, returns Blob + url
│   │   ├── preferences.ts       # Zustand persist store. mlEnabled toggle. Exports `isIOS`
│   │   ├── seedData.ts          # DEV ONLY — example wardrobe seeder, fillMissingPhotos, backfillEmbeddings
│   │   ├── shell.ts             # useShell zustand + useOverlay() hook (fades TabBar when sheets are open)
│   │   ├── toast.ts             # toast.success/error/info
│   │   ├── utils.ts             # cn(), makeId()
│   │   └── wrapped.ts           # Year-in-clothes recap PNG renderer (Canvas 2D, 1080×1920)
│   ├── routes/
│   │   ├── BulkCapture.tsx      # Gallery batch — pick up to 30, sequential ML pipeline, save together
│   │   ├── Capture.tsx          # Photo → bg removal → detection → duplicate check → form → save
│   │   ├── Closet.tsx           # Grid + category filter + occasion filter rail + Want list link
│   │   ├── Insights.tsx         # Honesty report — stats, trend, regret, donations, forgotten pairs, palettes, dormant
│   │   ├── ItemDetail.tsx       # Read view + edit mode + wear stats + wear history + backdate UI
│   │   ├── Log.tsx              # Yesterday prompt + Today's hero + saved-outfits rail + recent days expand + day notes + calendar backdate
│   │   ├── Settings.tsx         # Privacy, ML toggle, storage, Wrapped, export, delete, diagnostics, dev seeders
│   │   └── Wants.tsx            # Want list — pre-purchase consideration with inventory cross-check
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

## Data model (Dexie v7)

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

  // Occasion tags (v6) — multiEntry indexed via `*occasions` so Closet
  // can filter by any tag. See lib/occasions.ts for the canonical list.
  occasions?: string[]
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
  // When the wear was logged via a saved Outfit, this holds that outfit's id —
  // lets analytics ask "how often is this outfit worn".
  outfitId?: string
  createdAt: number
}

// v3 — saved outfit definitions (one-tap logging)
interface Outfit {
  id: string
  name: string
  itemIds: string[]             // ordered, refers to items.id (may include archived)
  createdAt: number
  updatedAt: number
  archivedAt?: number           // soft delete
}

// v4 — per-day diary note ("Wore this to Sneha's wedding"). Keyed by dayMs
// so it survives even when every wear from that day is removed.
interface DayNote {
  dayMs: number                 // primary key — start-of-day in local TZ
  note: string
  updatedAt: number
}

// v5 — pre-purchase consideration. Lets the inventory cross-check land
// before money is spent. Decisions ('bought'|'passed') stay for the record.
interface Want {
  id: string
  name: string
  category?: string
  color?: string
  brand?: string
  estimatedPriceMinor?: number
  source?: string               // URL / store / "Insta ad"
  note?: string                 // why they want it
  createdAt: number
  decision?: 'bought' | 'passed'
  decidedAt?: number
}

// v7 — CLIP image embedding for visual duplicate detection at capture time
interface ItemEmbedding {
  itemId: string                // primary key, FK → items.id
  embedding: Float32Array       // 512-dim, L2-normalized
  model: string                 // 'Xenova/clip-vit-base-patch32'
  createdAt: number
}
```

Migrations are append-only — every `db.version()` call stays declared so
existing user databases auto-upgrade. v6 added `*occasions` multiEntry index.

**Always go through helpers** in `src/db/{items,wears,outfits,dayNotes,wants}.ts`.
Don't poke `db.<table>` directly from components.

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

**Completed: v0.1 → v0.8 + design refresh.**

v0.1–v0.5 foundation:
- ✅ PWA shell, install prompt, offline-capable
- ✅ Capture: photo → bg removal (RMBG-1.4) → auto-detect category (CLIP) + color → form → save
- ✅ Closet grid + category filter + item detail (edit / archive with reason / replace photo)
- ✅ Pre-owned baseline (seedWearCount + seedAsOf), backdate wear, wear logging (today + recent days)
- ✅ Insights v1: stats, 12-week trend, most-worn / best-CPW / worst-CPW / dormant / by-category
- ✅ Settings: privacy, ML toggle, storage, export, delete-all, diagnostics
- ✅ iOS-specific: ML toggle defaults OFF on iOS, WASM forced (WebGPU silently crashes RMBG on Safari 18)

v0.6 — bulk capture:
- ✅ Gallery batch picker (up to 30), sequential ML pipeline per item, single review pass, batch save

v0.7 — saved outfits:
- ✅ `outfits` table (Dexie v3), Log rail with 2x2 thumb chips, detail sheet (Wear today / Edit / Delete)
- ✅ Wears logged via a saved outfit carry `outfitId = savedOutfit.id` → future analytics knows "how often is this outfit worn"

Design refresh:
- ✅ Editorial dark UI: Fraunces + Inter via Google Fonts, surface tokens, hairlines, rounded-card/sheet
- ✅ Floating capsule TabBar with 4 tabs + centred Add FAB (replaced the flat 5-tab bar)
- ✅ `useOverlay()` shell pattern: any sheet pushes a counter, TabBar fades when > 0 (so sheet footers aren't covered)
- ✅ `scrollbar-none` utility for chip rails

v0.8 — analytics depth + shopping conscience:
- ✅ **Buyer's regret** — bought in last 90 days, never worn (Insights)
- ✅ **Worn colours** — palette weighted by wears, with swatches (Insights, uses `lib/colors.ts`)
- ✅ **Forgotten pairs** — items co-worn ≥3 times, dormant 60d+ (Insights, `computeDormantPairs`)
- ✅ **Worth letting go?** — donation review: priced items unworn 6mo+ with ₹ tied up
- ✅ **Auto save-this-combo** — suggest saving as outfit after 3+ items logged same day
- ✅ **Yesterday's outfit?** — backfill prompt on Log when yesterday is empty
- ✅ **Day diary notes** — per-day text notes (DayNote table v4), shown in today's hero + recent-day expand
- ✅ **Want list** — `/wants` route, live inventory cross-check ("you already own 4 tops"), Bought/Pass actions (Want table v5)
- ✅ **Occasion tags** — Casual/Office/Festive/Wedding/Travel/Sport/Lounge/Formal, multiEntry indexed (v6), filter rail on Closet
- ✅ **Calendar-grid backdate** — 35-day grid sheet from Log header, taps any day to log/backfill
- ✅ **Visual duplicate detection** — CLIP image embeddings (v7), warns at capture if a similar item already exists (cosine ≥ 0.88)
- ✅ **Year in clothes** — Wrapped recap: 1080×1920 PNG with hero photo, top stats, top colour swatch (Settings → Year in clothes)

**Roadmap (not built):**

- ⏳ Vibe-based outfit suggestions (CLIP embeddings already exist — v7 — for ranking)
- ⏳ Selfie auto-log (mirror selfie → CLIP match → log wear)
- ⏳ Gmail receipt import (deferred per user — privacy-first OAuth flow)
- ⏳ HEIC handling improvements (iOS gallery delivers HEIC; canvas decode is brittle)
- ⏳ Code-split transformers.js (currently in main bundle)
- ⏳ Optional cloud sync with E2E encryption (only if explicitly requested)

**Researched, NOT viable:**

- ❌ **Daily-log push notifications.** Real scheduled push requires a backend (VAPID) which violates the privacy-first commitment. `Notification Triggers` was a Chrome origin trial that never shipped. `periodicSync` is Chrome-Android-only on installed PWAs and unreliable. The in-app "Yesterday's outfit?" prompt covers the same job-to-be-done when the user opens Hangr — keep that as the substitute.

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
npm run generate-pwa-assets       # Once after icon.png changes
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
