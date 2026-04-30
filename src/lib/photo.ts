/**
 * Photo utilities — read a File or Blob, resize to a sane max dimension,
 * encode as JPEG. Keeps IndexedDB writes manageable and renders fast.
 */

export interface ProcessedPhoto {
  blob: Blob
  width: number
  height: number
  /** Object URL (caller should revoke when done). */
  url: string
}

export async function processPhoto(
  file: File | Blob,
  opts: { maxDimension?: number; quality?: number; mimeType?: string } = {},
): Promise<ProcessedPhoto> {
  const maxDim = opts.maxDimension ?? 1600
  const quality = opts.quality ?? 0.9
  const mime = opts.mimeType ?? 'image/jpeg'

  const inputUrl = URL.createObjectURL(file)
  try {
    const img = await loadImage(inputUrl)
    let { width, height } = img
    const longSide = Math.max(width, height)
    if (longSide > maxDim) {
      const scale = maxDim / longSide
      width = Math.round(width * scale)
      height = Math.round(height * scale)
    }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')
    ctx.drawImage(img, 0, 0, width, height)
    const blob = await canvasToBlob(canvas, mime, quality)
    const url = URL.createObjectURL(blob)
    return { blob, width, height, url }
  } finally {
    URL.revokeObjectURL(inputUrl)
  }
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime = 'image/jpeg',
  quality = 0.9,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      mime,
      quality,
    )
  })
}
