import { db, type ArchivedReason, type Item, type ItemPhoto } from './dexie'
import { makeId } from '@/lib/utils'

/**
 * Data layer helpers for items and item photos.
 * Anything UI-facing should go through these — never touch `db.items` directly
 * from a component.
 */

export interface CreateItemInput {
  name: string
  category?: string
  color?: string
  brand?: string
  purchasePriceMinor?: number
  purchasedAt?: number
  source?: 'manual' | 'gmail' | 'ledgr'
  /** Pre-owned baseline. */
  seedWearCount?: number
  seedAsOf?: number
  /** Occasion tags — Festive, Wedding, Office, etc. See lib/occasions.ts. */
  occasions?: string[]
  photo?: {
    blob: Blob
    width: number
    height: number
    isProcessed?: boolean
  }
}

export async function createItem(input: CreateItemInput): Promise<Item> {
  const itemId = makeId('item')
  const now = Date.now()
  let primaryPhotoId: string | undefined

  await db.transaction('rw', db.items, db.itemPhotos, async () => {
    if (input.photo) {
      const photoId = makeId('photo')
      const photo: ItemPhoto = {
        id: photoId,
        itemId,
        blob: input.photo.blob,
        width: input.photo.width,
        height: input.photo.height,
        isProcessed: input.photo.isProcessed ?? false,
        createdAt: now,
      }
      await db.itemPhotos.add(photo)
      primaryPhotoId = photoId
    }

    const item: Item = {
      id: itemId,
      name: input.name,
      category: input.category,
      color: input.color,
      brand: input.brand,
      primaryPhotoId,
      purchasePriceMinor: input.purchasePriceMinor,
      purchasedAt: input.purchasedAt,
      source: input.source ?? 'manual',
      createdAt: now,
      seedWearCount: input.seedWearCount,
      seedAsOf: input.seedAsOf,
      occasions:
        input.occasions && input.occasions.length > 0
          ? input.occasions
          : undefined,
    }
    await db.items.add(item)
  })

  const item = await db.items.get(itemId)
  return item!
}

export async function listItems(opts: { includeArchived?: boolean } = {}) {
  const all = await db.items.orderBy('createdAt').reverse().toArray()
  if (opts.includeArchived) return all
  return all.filter((item) => !item.archivedAt)
}

export async function getItem(id: string) {
  return db.items.get(id)
}

export async function getItemPhoto(id: string | undefined) {
  if (!id) return undefined
  return db.itemPhotos.get(id)
}

export async function archiveItem(
  id: string,
  reason?: ArchivedReason,
  note?: string,
) {
  await db.items.update(id, {
    archivedAt: Date.now(),
    archivedReason: reason,
    archivedNote: note?.trim() || undefined,
  })
}

export async function unarchiveItem(id: string) {
  await db.items.update(id, {
    archivedAt: undefined,
    archivedReason: undefined,
    archivedNote: undefined,
  })
}

export async function updateItem(id: string, patch: Partial<Item>) {
  await db.items.update(id, patch)
}

export async function replaceItemPhoto(
  itemId: string,
  blob: Blob,
  width: number,
  height: number,
  isProcessed = false,
) {
  const photoId = makeId('photo')
  await db.transaction('rw', db.items, db.itemPhotos, async () => {
    const item = await db.items.get(itemId)
    if (!item) throw new Error('Item not found')
    if (item.primaryPhotoId) {
      await db.itemPhotos.delete(item.primaryPhotoId)
    }
    await db.itemPhotos.add({
      id: photoId,
      itemId,
      blob,
      width,
      height,
      isProcessed,
      createdAt: Date.now(),
    })
    await db.items.update(itemId, { primaryPhotoId: photoId })
  })
  return photoId
}

/** Hard delete item + photos + wears. Used by Settings → Delete all data. */
export async function deleteItemHard(id: string) {
  await db.transaction('rw', db.items, db.itemPhotos, db.wears, async () => {
    await db.items.delete(id)
    await db.itemPhotos.where('itemId').equals(id).delete()
    await db.wears.where('itemId').equals(id).delete()
  })
}
