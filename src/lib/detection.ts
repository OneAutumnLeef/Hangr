/**
 * Auto-detection helpers — runs alongside bg removal in the capture flow.
 *
 * - `detectDominantColor` is pure JS (no ML). Runs in milliseconds.
 * - `detectCategory` uses CLIP zero-shot image classification via
 *   transformers.js. First call downloads ~80MB (quantized CLIP-base);
 *   subsequent calls hit the IndexedDB cache.
 *
 * Photos never leave the device. Both functions are best-effort —
 * callers should treat results as suggestions, not ground truth.
 */

import { pipeline } from '@huggingface/transformers'
import { loadImage } from './photo'

// ─── Color detection (no ML) ────────────────────────────────────────────────

export interface DetectedColor {
  hex: string
  name: string
  /** 0-255 each. */
  rgb: [number, number, number]
}

/**
 * Sample the photo at low res, take the median RGB of opaque pixels,
 * and snap to the nearest named color in our small palette.
 */
export async function detectDominantColor(
  blob: Blob,
): Promise<DetectedColor | undefined> {
  const url = URL.createObjectURL(blob)
  try {
    const img = await loadImage(url)
    const target = 64
    const canvas = document.createElement('canvas')
    canvas.width = target
    canvas.height = target
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined
    ctx.drawImage(img, 0, 0, target, target)
    const { data } = ctx.getImageData(0, 0, target, target)

    const rs: number[] = []
    const gs: number[] = []
    const bs: number[] = []
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3]
      // Skip transparent (cut-out background) and near-white edges of frames
      if (a < 200) continue
      rs.push(data[i])
      gs.push(data[i + 1])
      bs.push(data[i + 2])
    }
    if (rs.length === 0) return undefined

    const med = (arr: number[]) => {
      const sorted = [...arr].sort((a, b) => a - b)
      return sorted[Math.floor(sorted.length / 2)]
    }
    const r = med(rs)
    const g = med(gs)
    const b = med(bs)
    const hex =
      '#' +
      [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
    return { hex, name: nearestColorName(r, g, b), rgb: [r, g, b] }
  } catch (err) {
    console.warn('Color detection failed:', err)
    return undefined
  } finally {
    URL.revokeObjectURL(url)
  }
}

const PALETTE: { name: string; rgb: [number, number, number] }[] = [
  { name: 'Black', rgb: [10, 10, 10] },
  { name: 'White', rgb: [240, 240, 240] },
  { name: 'Gray', rgb: [128, 128, 128] },
  { name: 'Charcoal', rgb: [55, 55, 60] },
  { name: 'Red', rgb: [200, 30, 30] },
  { name: 'Maroon', rgb: [110, 30, 30] },
  { name: 'Orange', rgb: [240, 130, 30] },
  { name: 'Yellow', rgb: [240, 220, 50] },
  { name: 'Mustard', rgb: [200, 170, 40] },
  { name: 'Green', rgb: [40, 160, 80] },
  { name: 'Olive', rgb: [120, 130, 70] },
  { name: 'Teal', rgb: [40, 140, 140] },
  { name: 'Blue', rgb: [50, 100, 200] },
  { name: 'Navy', rgb: [20, 30, 90] },
  { name: 'Sky', rgb: [120, 180, 230] },
  { name: 'Purple', rgb: [120, 60, 180] },
  { name: 'Pink', rgb: [240, 130, 180] },
  { name: 'Brown', rgb: [120, 70, 30] },
  { name: 'Tan', rgb: [200, 170, 130] },
  { name: 'Beige', rgb: [220, 200, 170] },
  { name: 'Cream', rgb: [240, 230, 200] },
  { name: 'Khaki', rgb: [180, 170, 130] },
]

function nearestColorName(r: number, g: number, b: number): string {
  let best = PALETTE[0]
  let bestDist = Infinity
  for (const c of PALETTE) {
    const [pr, pg, pb] = c.rgb
    // Weighted RGB distance — humans are more sensitive to green
    const d =
      2 * (pr - r) * (pr - r) +
      4 * (pg - g) * (pg - g) +
      3 * (pb - b) * (pb - b)
    if (d < bestDist) {
      bestDist = d
      best = c
    }
  }
  return best.name
}

// ─── Category detection (CLIP zero-shot) ────────────────────────────────────

/**
 * Each category gets a natural-language prompt. CLIP picks the best-matching
 * prompt; we map back to our category label.
 */
const CATEGORY_PROMPTS: { label: string; prompts: string[] }[] = [
  {
    label: 'Top',
    prompts: [
      'a photo of a t-shirt',
      'a photo of a shirt',
      'a photo of a top',
      'a photo of a blouse',
    ],
  },
  {
    label: 'Bottom',
    prompts: [
      'a photo of jeans',
      'a photo of pants or trousers',
      'a photo of shorts',
      'a photo of a skirt',
    ],
  },
  {
    label: 'Outerwear',
    prompts: [
      'a photo of a jacket',
      'a photo of a coat',
      'a photo of a hoodie',
      'a photo of a sweater',
    ],
  },
  {
    label: 'Shoes',
    prompts: [
      'a photo of shoes',
      'a photo of sneakers',
      'a photo of boots',
      'a photo of sandals',
    ],
  },
  {
    label: 'Dress',
    prompts: ['a photo of a dress', 'a photo of a gown'],
  },
  {
    label: 'Ethnic',
    prompts: [
      'a photo of a kurta',
      'a photo of a saree',
      'a photo of a salwar kameez',
      'a photo of a sherwani',
      'a photo of traditional Indian clothing',
    ],
  },
  {
    label: 'Accessory',
    prompts: [
      'a photo of a bag',
      'a photo of a backpack',
      'a photo of a watch',
      'a photo of sunglasses',
      'a photo of a hat',
      'a photo of a belt',
    ],
  },
  {
    label: 'Innerwear',
    prompts: ['a photo of underwear', 'a photo of innerwear'],
  },
]

const FLAT_PROMPTS = CATEGORY_PROMPTS.flatMap((c) =>
  c.prompts.map((p) => ({ label: c.label, prompt: p })),
)

// Reuse the pipeline across detections. transformers.js caches the model
// in IndexedDB, so first call downloads ~80MB, subsequent calls are instant.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let classifierPromise: Promise<any> | null = null

export type CategoryDetectionProgress =
  | { stage: 'loading-model'; progress: number }
  | { stage: 'classifying' }

export async function ensureClassifierLoaded(
  onProgress?: (p: CategoryDetectionProgress) => void,
) {
  if (classifierPromise) return classifierPromise
  classifierPromise = pipeline(
    'zero-shot-image-classification',
    'Xenova/clip-vit-base-patch32',
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      progress_callback: (data: any) => {
        if (data?.status === 'progress' && onProgress) {
          onProgress({
            stage: 'loading-model',
            progress: Math.round(data.progress ?? 0),
          })
        }
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as Promise<any>
  return classifierPromise
}

export async function detectCategory(
  blob: Blob,
  onProgress?: (p: CategoryDetectionProgress) => void,
): Promise<{ label: string; score: number } | undefined> {
  const url = URL.createObjectURL(blob)
  try {
    const classifier = await ensureClassifierLoaded(onProgress)
    onProgress?.({ stage: 'classifying' })
    const labels = FLAT_PROMPTS.map((p) => p.prompt)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (await classifier(url, labels)) as Array<{
      label: string
      score: number
    }>
    if (!Array.isArray(result) || result.length === 0) return undefined
    // Sum scores per category (a category may have multiple prompts)
    const totals = new Map<string, number>()
    for (const r of result) {
      const match = FLAT_PROMPTS.find((p) => p.prompt === r.label)
      if (!match) continue
      totals.set(match.label, (totals.get(match.label) ?? 0) + r.score)
    }
    const sorted = Array.from(totals.entries()).sort((a, b) => b[1] - a[1])
    if (sorted.length === 0) return undefined
    return { label: sorted[0][0], score: sorted[0][1] }
  } catch (err) {
    console.warn('Category detection failed:', err)
    return undefined
  } finally {
    URL.revokeObjectURL(url)
  }
}
