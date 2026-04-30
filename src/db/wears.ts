import { db, type Outfit, type Wear } from './dexie'
import { makeId } from '@/lib/utils'
import { startOfDay } from '@/lib/dates'

export interface LogWearInput {
  itemId: string
  /** Defaults to today's local midnight. */
  wornAt?: number
  source?: Wear['source']
  outfitId?: string
}

export async function logWear(input: LogWearInput): Promise<Wear> {
  const wornAt = input.wornAt ?? startOfDay()
  const wear: Wear = {
    id: makeId('wear'),
    itemId: input.itemId,
    wornAt,
    source: input.source ?? 'manual',
    outfitId: input.outfitId,
    createdAt: Date.now(),
  }
  await db.wears.add(wear)
  return wear
}

/** Log multiple items in one outfit (same day, same outfitId). */
export async function logOutfit(
  itemIds: string[],
  date: number = startOfDay(),
): Promise<string> {
  const outfitId = makeId('outfit')
  const now = Date.now()
  await db.wears.bulkAdd(
    itemIds.map((itemId) => ({
      id: makeId('wear'),
      itemId,
      wornAt: date,
      source: 'manual' as const,
      outfitId,
      createdAt: now,
    })),
  )
  return outfitId
}

/**
 * Log a wear for every item in a saved Outfit, all sharing the outfit's id
 * as `outfitId`. Reusing the saved outfit's id (rather than minting a fresh
 * group id) lets future analytics ask "how often is this saved outfit worn."
 */
export async function logSavedOutfit(
  outfit: Pick<Outfit, 'id' | 'itemIds'>,
  date: number = startOfDay(),
): Promise<string[]> {
  const now = Date.now()
  const wears: Wear[] = outfit.itemIds.map((itemId) => ({
    id: makeId('wear'),
    itemId,
    wornAt: date,
    source: 'manual' as const,
    outfitId: outfit.id,
    createdAt: now,
  }))
  await db.wears.bulkAdd(wears)
  return wears.map((w) => w.id)
}

export async function deleteWear(id: string) {
  await db.wears.delete(id)
}

export async function listWearsForItem(itemId: string): Promise<Wear[]> {
  const all = await db.wears.where('itemId').equals(itemId).toArray()
  return all.sort((a, b) => b.wornAt - a.wornAt)
}

export async function listWearsForDay(dayMs: number): Promise<Wear[]> {
  return db.wears.where('wornAt').equals(dayMs).toArray()
}

export async function listWearsBetween(
  startMs: number,
  endMs: number,
): Promise<Wear[]> {
  return db.wears.where('wornAt').between(startMs, endMs, true, true).toArray()
}

export async function countWearsForItem(itemId: string): Promise<number> {
  return db.wears.where('itemId').equals(itemId).count()
}

export interface ItemWearStats {
  count: number
  lastWornAt?: number
}

/** Aggregate wears across all items in a single Dexie pass. */
export async function getWearStatsByItem(): Promise<Map<string, ItemWearStats>> {
  const all = await db.wears.toArray()
  const stats = new Map<string, ItemWearStats>()
  for (const w of all) {
    const cur = stats.get(w.itemId) ?? { count: 0, lastWornAt: undefined }
    cur.count += 1
    if (cur.lastWornAt == null || w.wornAt > cur.lastWornAt) {
      cur.lastWornAt = w.wornAt
    }
    stats.set(w.itemId, cur)
  }
  return stats
}

/** Group recent wears into days (newest first), capped at `limit` days. */
export interface WearDay {
  dayMs: number
  itemIds: string[]
  wearIds: string[]
}

export async function listRecentWearDays(limit = 30): Promise<WearDay[]> {
  const all = await db.wears.toArray()
  const byDay = new Map<number, WearDay>()
  for (const w of all) {
    const existing = byDay.get(w.wornAt) ?? {
      dayMs: w.wornAt,
      itemIds: [],
      wearIds: [],
    }
    existing.itemIds.push(w.itemId)
    existing.wearIds.push(w.id)
    byDay.set(w.wornAt, existing)
  }
  return Array.from(byDay.values())
    .sort((a, b) => b.dayMs - a.dayMs)
    .slice(0, limit)
}
