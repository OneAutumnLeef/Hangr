import { db } from '@/db/dexie'

/**
 * Export everything in the Hangr database to a single JSON blob.
 * Photos are inlined as data URLs so the file is fully self-contained.
 *
 * The format is versioned (`schema: 'hangr/v1'`) so future imports can detect
 * old shapes if we ever ship import.
 */
export async function exportAllData(): Promise<Blob> {
  const [items, photos, wears, outfits, dayNotes, wants] = await Promise.all([
    db.items.toArray(),
    db.itemPhotos.toArray(),
    db.wears.toArray(),
    db.outfits.toArray(),
    db.dayNotes.toArray(),
    db.wants.toArray(),
  ])

  const photosWithDataUrl = await Promise.all(
    photos.map(async (p) => ({
      id: p.id,
      itemId: p.itemId,
      width: p.width,
      height: p.height,
      isProcessed: p.isProcessed,
      createdAt: p.createdAt,
      dataUrl: await blobToDataUrl(p.blob),
    })),
  )

  const dump = {
    schema: 'hangr/v4',
    exportedAt: new Date().toISOString(),
    items,
    itemPhotos: photosWithDataUrl,
    wears,
    outfits,
    dayNotes,
    wants,
  }

  return new Blob([JSON.stringify(dump)], { type: 'application/json' })
}

/** Wipe all Hangr data from this device. Irreversible. */
export async function deleteAllData() {
  await db.transaction(
    'rw',
    [
      db.items,
      db.itemPhotos,
      db.wears,
      db.outfits,
      db.dayNotes,
      db.wants,
      db.itemEmbeddings,
    ],
    async () => {
      await db.items.clear()
      await db.itemPhotos.clear()
      await db.wears.clear()
      await db.outfits.clear()
      await db.dayNotes.clear()
      await db.wants.clear()
      await db.itemEmbeddings.clear()
    },
  )
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read blob'))
    reader.readAsDataURL(blob)
  })
}

export interface StorageEstimate {
  usageBytes: number
  quotaBytes: number
}

export async function getStorageEstimate(): Promise<StorageEstimate | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return null
  }
  const { usage = 0, quota = 0 } = await navigator.storage.estimate()
  return { usageBytes: usage, quotaBytes: quota }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  )
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}
