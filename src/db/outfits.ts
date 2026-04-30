import { db, type Outfit } from './dexie'
import { makeId } from '@/lib/utils'

/**
 * Saved outfit helpers. Outfits are stored as ordered itemId arrays — when
 * member items are deleted, the outfit just shows fewer thumbs (callers should
 * tolerate `undefined` lookups).
 */

export interface CreateOutfitInput {
  name: string
  itemIds: string[]
}

export async function createOutfit(input: CreateOutfitInput): Promise<Outfit> {
  const now = Date.now()
  const outfit: Outfit = {
    id: makeId('outfit'),
    name: input.name.trim(),
    itemIds: input.itemIds,
    createdAt: now,
    updatedAt: now,
  }
  await db.outfits.add(outfit)
  return outfit
}

export async function listOutfits(
  opts: { includeArchived?: boolean } = {},
): Promise<Outfit[]> {
  const all = await db.outfits.orderBy('createdAt').reverse().toArray()
  if (opts.includeArchived) return all
  return all.filter((o) => !o.archivedAt)
}

export async function getOutfit(id: string): Promise<Outfit | undefined> {
  return db.outfits.get(id)
}

export async function updateOutfit(
  id: string,
  patch: Partial<Pick<Outfit, 'name' | 'itemIds'>>,
) {
  await db.outfits.update(id, { ...patch, updatedAt: Date.now() })
}

export async function archiveOutfit(id: string) {
  await db.outfits.update(id, {
    archivedAt: Date.now(),
    updatedAt: Date.now(),
  })
}

export async function unarchiveOutfit(id: string) {
  await db.outfits.update(id, {
    archivedAt: undefined,
    updatedAt: Date.now(),
  })
}

/** Hard delete — used by Settings → Delete all data. */
export async function deleteOutfitHard(id: string) {
  await db.outfits.delete(id)
}
