import Dexie, { type EntityTable } from 'dexie'

/**
 * Hangr local data layer (IndexedDB via Dexie).
 *
 * Everything lives on the user's device. No remote sync.
 *
 * Schema is intentionally minimal for v0 — just enough to prove storage works.
 * It will grow: outfit, vibe, embedding, receipt, etc. tables come later.
 *
 * Photos are stored as Blobs in `itemPhotos` (separate from `items`) to keep
 * the items table light when listing/filtering.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/** Top-level wardrobe item. */
export interface Item {
  id: string
  name: string
  /** Loose category tag — we'll formalize an enum once we have real items. */
  category?: string
  color?: string
  brand?: string
  /** Foreign key into `itemPhotos`. */
  primaryPhotoId?: string
  /** Stored in minor units (paise) to avoid float drift. ₹100 = 10000. */
  purchasePriceMinor?: number
  /** Unix ms of purchase date, if known. */
  purchasedAt?: number
  /** Where this item entered Hangr. */
  source?: 'manual' | 'gmail' | 'ledgr'
  createdAt: number
  /** Soft-delete; null/undefined = active. */
  archivedAt?: number
}

/** Photos kept separate so the items table stays small for queries. */
export interface ItemPhoto {
  id: string
  itemId: string
  blob: Blob
  width: number
  height: number
  /** Whether the background has been removed. */
  isProcessed: boolean
  createdAt: number
}

/** A single wear event. Wears are append-only. */
export interface Wear {
  id: string
  itemId: string
  /** Unix ms — represents the local date the item was worn. */
  wornAt: number
  /** How the wear was logged. */
  source: 'manual' | 'selfie' | 'inferred'
  /** Optional outfit grouping; multiple wears with the same outfitId form an outfit. */
  outfitId?: string
  createdAt: number
}

// ─── Dexie schema ───────────────────────────────────────────────────────────

const db = new Dexie('hangr') as Dexie & {
  items: EntityTable<Item, 'id'>
  itemPhotos: EntityTable<ItemPhoto, 'id'>
  wears: EntityTable<Wear, 'id'>
}

db.version(1).stores({
  items: 'id, category, archivedAt, createdAt, source',
  itemPhotos: 'id, itemId, createdAt',
  wears: 'id, itemId, wornAt, outfitId, createdAt',
})

// Useful for ad-hoc inspection in DevTools while building.
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  ;(window as unknown as { db: typeof db }).db = db
}

export { db }
