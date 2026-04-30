/**
 * CLIP image embeddings for visual duplicate detection.
 *
 * Same model (Xenova/clip-vit-base-patch32) the zero-shot category classifier
 * already loads — transformers.js caches the weights in IndexedDB so the
 * second pipeline ("image-feature-extraction") spins up almost instantly.
 *
 * Embeddings are stored per item in `itemEmbeddings`. We compare with
 * cosine similarity; pairs above ~0.85 reliably look like the same garment
 * to a human. Lower → fast/false positives, higher → strict/misses near-matches.
 */

import { pipeline } from '@huggingface/transformers'
import { db } from '@/db/dexie'
import { isIOS } from './preferences'

const MODEL_ID = 'Xenova/clip-vit-base-patch32'

function preferredDevice(): 'webgpu' | 'wasm' {
  if (isIOS) return 'wasm'
  if (typeof navigator !== 'undefined' && 'gpu' in navigator) return 'webgpu'
  return 'wasm'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractorPromise: Promise<any> | null = null

export async function ensureExtractorLoaded() {
  if (extractorPromise) return extractorPromise
  const device = preferredDevice()
  extractorPromise = pipeline(
    'image-feature-extraction',
    MODEL_ID,
    {
      device,
      dtype: device === 'wasm' ? 'q8' : 'fp32',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as Promise<any>
  return extractorPromise
}

/** Reject after `ms` if `p` hasn't settled. Same shape as the bgRemoval helper. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms / 1000}s`)),
      ms,
    )
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

export async function extractEmbedding(blob: Blob): Promise<Float32Array> {
  const extractor = await withTimeout(
    ensureExtractorLoaded(),
    90_000,
    'Embedding model load',
  )
  const url = URL.createObjectURL(blob)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await withTimeout(
      extractor(url, { pooling: 'mean', normalize: true }) as Promise<unknown>,
      30_000,
      'Embedding inference',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    )) as any
    // result is a Tensor; result.data is a Float32Array
    return new Float32Array(result.data)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Cosine similarity between two same-length Float32Arrays. Both inputs are
 *  assumed to be already L2-normalized (we pass `normalize: true` above), so
 *  the cosine reduces to the dot product. We still divide by norms as a
 *  safety net in case an upstream change breaks normalization. */
export function cosine(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom > 0 ? dot / denom : 0
}

export interface SimilarItem {
  itemId: string
  score: number
}

/**
 * Compute the embedding for `blob` and return the closest existing items
 * above `threshold`, sorted descending. Excludes archived items and the
 * optional `excludeItemId` (used when re-embedding an item to skip self).
 */
export async function findSimilarItems(
  blob: Blob,
  opts: {
    threshold?: number
    limit?: number
    excludeItemId?: string
  } = {},
): Promise<SimilarItem[]> {
  const threshold = opts.threshold ?? 0.85
  const limit = opts.limit ?? 3
  const newEmb = await extractEmbedding(blob)
  const all = await db.itemEmbeddings.toArray()
  const out: SimilarItem[] = []
  for (const e of all) {
    if (opts.excludeItemId && e.itemId === opts.excludeItemId) continue
    const score = cosine(newEmb, e.embedding)
    if (score >= threshold) out.push({ itemId: e.itemId, score })
  }
  // Filter out archived items at the end (cheaper than fanning a query per id)
  if (out.length === 0) return out
  const items = await db.items.bulkGet(out.map((s) => s.itemId))
  const filtered = out.filter((_, i) => items[i] && !items[i]!.archivedAt)
  filtered.sort((a, b) => b.score - a.score)
  return filtered.slice(0, limit)
}

/** Persist an item's embedding. Idempotent — overwrites any prior entry. */
export async function storeItemEmbedding(
  itemId: string,
  embedding: Float32Array,
) {
  await db.itemEmbeddings.put({
    itemId,
    embedding,
    model: MODEL_ID,
    createdAt: Date.now(),
  })
}

/** Compute + store the embedding for an item using its primary photo blob.
 *  Called both at capture-time and from the Settings backfill helper. */
export async function indexItemPhoto(
  itemId: string,
  blob: Blob,
): Promise<void> {
  const emb = await extractEmbedding(blob)
  await storeItemEmbedding(itemId, emb)
}
