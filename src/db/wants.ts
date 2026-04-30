import { db, type Want } from './dexie'
import { makeId } from '@/lib/utils'

/**
 * Want list — items the user is thinking about buying. The point isn't to
 * be a wishlist tracker; it's to introduce a pause before purchase so the
 * inventory cross-check ("you already own 4 white shirts") can land.
 *
 * Decided wants (bought/passed) stay in the DB for the record — the list
 * filters them out by default but they're still queryable for analytics.
 */

export interface CreateWantInput {
  name: string
  category?: string
  color?: string
  brand?: string
  estimatedPriceMinor?: number
  source?: string
  note?: string
}

export async function createWant(input: CreateWantInput): Promise<Want> {
  const want: Want = {
    id: makeId('want'),
    name: input.name.trim(),
    category: input.category,
    color: input.color?.trim() || undefined,
    brand: input.brand?.trim() || undefined,
    estimatedPriceMinor: input.estimatedPriceMinor,
    source: input.source?.trim() || undefined,
    note: input.note?.trim() || undefined,
    createdAt: Date.now(),
  }
  await db.wants.add(want)
  return want
}

export async function listWants(
  opts: { includeDecided?: boolean } = {},
): Promise<Want[]> {
  const all = await db.wants.orderBy('createdAt').reverse().toArray()
  if (opts.includeDecided) return all
  return all.filter((w) => w.decision == null)
}

export async function getWant(id: string): Promise<Want | undefined> {
  return db.wants.get(id)
}

export async function updateWant(
  id: string,
  patch: Partial<Pick<Want, 'name' | 'category' | 'color' | 'brand' | 'estimatedPriceMinor' | 'source' | 'note'>>,
) {
  await db.wants.update(id, patch)
}

/** Mark a want as decided. 'bought' = the user pulled the trigger; 'passed'
 *  = they reconsidered and skipped. Both keep the row for the record. */
export async function decideWant(
  id: string,
  decision: 'bought' | 'passed',
): Promise<void> {
  await db.wants.update(id, {
    decision,
    decidedAt: Date.now(),
  })
}

export async function deleteWant(id: string): Promise<void> {
  await db.wants.delete(id)
}
