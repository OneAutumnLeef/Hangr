import Dexie, { type EntityTable } from 'dexie'

/**
 * Hangr local data layer (IndexedDB via Dexie).
 *
 * Everything lives on the user's device. No remote sync.
 *
 * Photos are stored as Blobs in `itemPhotos` (separate from `items`) to keep
 * the items table light when listing/filtering.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type ArchivedReason =
  | 'donated'
  | 'sold'
  | 'gifted'
  | 'lost'
  | 'damaged'
  | 'replaced'
  | 'outgrown'
  | 'unworn'
  | 'other'

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

  // ─── Archive ────────────────────────────────────────────────────────────
  /** Soft-delete; null/undefined = active. */
  archivedAt?: number
  /** Why this item left the active wardrobe. */
  archivedReason?: ArchivedReason
  archivedNote?: string

  // ─── Pre-owned baseline ─────────────────────────────────────────────────
  /**
   * Estimated wears that happened BEFORE the item was added to Hangr.
   * Combined with logged Wear records to compute "real" totals.
   */
  seedWearCount?: number
  /**
   * Approximate "owned since" date for the seed period.
   * Used as a fallback `lastWornAt` when no real wears have been logged yet
   * for a pre-owned item.
   */
  seedAsOf?: number
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
  source: 'manual' | 'selfie' | 'inferred' | 'backdated'
  /**
   * Optional outfit grouping. When the wear was logged via a saved Outfit, this
   * holds that outfit's id; that lets analytics ask "how often is this outfit
   * worn." Otherwise it's a per-instance group id from `logOutfit()`.
   */
  outfitId?: string
  createdAt: number
}

/**
 * A named bundle of items the user wears together regularly. Tapping a saved
 * outfit logs a wear for each item in one go — the friction killer for repeat
 * combos like "Friday casual" or "gym kit."
 */
export interface Outfit {
  id: string
  name: string
  /** Member item ids, ordered. Refers to `items.id` (may include archived). */
  itemIds: string[]
  createdAt: number
  updatedAt: number
  /** Soft delete; null/undefined = active. */
  archivedAt?: number
}

// ─── Dexie schema ───────────────────────────────────────────────────────────

const db = new Dexie('hangr') as Dexie & {
  items: EntityTable<Item, 'id'>
  itemPhotos: EntityTable<ItemPhoto, 'id'>
  wears: EntityTable<Wear, 'id'>
  outfits: EntityTable<Outfit, 'id'>
}

// v1 — initial schema
// v2 — add archivedReason, archivedNote, seedWearCount, seedAsOf to Item.
//      Non-indexed fields don't strictly need a version bump, but keeping a
//      record of schema evolution makes future migrations easier to reason about.
// v3 — add outfits table (saved outfit definitions for one-tap logging).
db.version(1).stores({
  items: 'id, category, archivedAt, createdAt, source',
  itemPhotos: 'id, itemId, createdAt',
  wears: 'id, itemId, wornAt, outfitId, createdAt',
})
db.version(2).stores({
  items: 'id, category, archivedAt, createdAt, source',
  itemPhotos: 'id, itemId, createdAt',
  wears: 'id, itemId, wornAt, outfitId, createdAt',
})
db.version(3).stores({
  items: 'id, category, archivedAt, createdAt, source',
  itemPhotos: 'id, itemId, createdAt',
  wears: 'id, itemId, wornAt, outfitId, createdAt',
  outfits: 'id, archivedAt, createdAt',
})

// Useful for ad-hoc inspection in DevTools while building.
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  ;(window as unknown as { db: typeof db }).db = db
}

export { db }
