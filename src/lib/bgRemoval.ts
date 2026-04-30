/**
 * Background removal via transformers.js + RMBG-1.4 (briaai).
 *
 * Runs entirely in the browser on WebGPU when available, WASM otherwise.
 * Model is downloaded once (~150MB) and cached by transformers.js in IndexedDB.
 *
 * Photos never leave the device.
 */

import { AutoModel, AutoProcessor, RawImage, env } from '@huggingface/transformers'
import { isIOS } from './preferences'

// Use the Hugging Face CDN for model weights. Models are then cached by
// transformers.js itself (IndexedDB / Cache API) — second run is instant.
env.allowLocalModels = false
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.proxy = false
}

const MODEL_ID = 'briaai/RMBG-1.4'

/**
 * iOS Safari 18+ exposes `navigator.gpu` (WebGPU support landed in 17/18) but
 * its WebGPU implementation is still immature: RMBG-1.4 inference reliably
 * crashes the page below the JS layer (no error is throwable, the tab silently
 * reloads). Force WASM on iOS until this stabilizes.
 */
function preferredDevice(): 'webgpu' | 'wasm' {
  if (isIOS) return 'wasm'
  if (typeof navigator !== 'undefined' && 'gpu' in navigator) return 'webgpu'
  return 'wasm'
}

// Loose types — transformers.js v3 still has rough typings, easier to keep flexible.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LoadedModel = { model: any; processor: any }
let modelPromise: Promise<LoadedModel> | null = null

export type BgRemovalProgress =
  | { stage: 'loading-model'; progress: number; file?: string }
  | { stage: 'processing' }

export async function ensureModelLoaded(
  onProgress?: (p: BgRemovalProgress) => void,
): Promise<void> {
  if (modelPromise) {
    await modelPromise
    return
  }
  modelPromise = (async () => {
    const progress_callback = (data: {
      status: string
      progress?: number
      file?: string
    }) => {
      if (onProgress && data.status === 'progress') {
        onProgress({
          stage: 'loading-model',
          progress: Math.round(data.progress ?? 0),
          file: data.file,
        })
      }
    }
    const device = preferredDevice()
    const model = await AutoModel.from_pretrained(MODEL_ID, {
      // RMBG-1.4 has a custom architecture; transformers.js will use the included
      // ONNX file directly.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: { model_type: 'custom' } as any,
      device,
      progress_callback,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    const processor = await AutoProcessor.from_pretrained(MODEL_ID, {
      // The model card spec for the image processor.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: {
        do_normalize: true,
        do_pad: false,
        do_rescale: true,
        do_resize: true,
        image_mean: [0.5, 0.5, 0.5],
        feature_extractor_type: 'ImageFeatureExtractor',
        image_std: [1, 1, 1],
        resample: 2,
        rescale_factor: 0.00392156862745098,
        size: { width: 1024, height: 1024 },
      } as any,
    })
    return { model, processor }
  })()
  await modelPromise
}

/** Reject after `ms` if `p` hasn't settled. */
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

/**
 * Remove the background from an image blob. Returns a PNG blob with transparency.
 *
 * Wrapped in a 90s timeout so iOS Safari can't hang the capture screen forever
 * when transformers.js or the model CDN stalls without throwing.
 */
export async function removeBackground(
  inputBlob: Blob,
  onProgress?: (p: BgRemovalProgress) => void,
): Promise<{ blob: Blob; width: number; height: number }> {
  await withTimeout(
    ensureModelLoaded(onProgress),
    90_000,
    'Background-removal model load',
  )
  if (!modelPromise) throw new Error('Model failed to load')
  const { model, processor } = await modelPromise

  onProgress?.({ stage: 'processing' })

  const url = URL.createObjectURL(inputBlob)
  try {
    const image = await withTimeout(
      RawImage.fromURL(url),
      15_000,
      'Image decode',
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const preproc = (await withTimeout(
      processor(image) as Promise<unknown>,
      15_000,
      'Image preprocessing',
    )) as any
    const { pixel_values } = preproc

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawOutput = (await withTimeout(
      model({ input: pixel_values }) as Promise<unknown>,
      45_000,
      'Inference',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    )) as any

    // Different transformers.js versions wrap the result differently.
    // Try every shape we've seen in the wild before giving up.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tensor: any =
      rawOutput?.output ??
      rawOutput?.logits ??
      rawOutput?.[0] ??
      rawOutput
    // Drop the batch dim
    if (typeof tensor?.[0] === 'object' && tensor?.[0] !== null) {
      tensor = tensor[0]
    }
    if (!tensor?.mul) {
      throw new Error(
        `RMBG output has unexpected shape (${typeof tensor}); transformers.js may have changed.`,
      )
    }

    // Convert mask to a uint8 RawImage and resize to the input dimensions.
    const maskRaw = RawImage.fromTensor(tensor.mul(255).to('uint8'))
    const mask = await maskRaw.resize(image.width, image.height)

    // Composite original RGB + mask alpha.
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')

    const bitmap = await createImageBitmap(inputBlob)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const maskData = mask.data as Uint8Array

    // The resized mask might be 1-channel (grayscale) or 4-channel (RGBA from
    // a canvas-based resize). Compute bytes-per-pixel and read the first
    // channel either way.
    const totalPixels = canvas.width * canvas.height
    const bytesPerMaskPixel = Math.max(
      1,
      Math.round(maskData.length / Math.max(1, totalPixels)),
    )
    if (
      maskData.length !== totalPixels * bytesPerMaskPixel ||
      bytesPerMaskPixel > 4
    ) {
      console.warn(
        `[Hangr bg removal] mask buffer (${maskData.length}B) doesn't divide evenly into ${totalPixels} pixels; cutout may be misaligned.`,
      )
    }

    for (let p = 0; p < totalPixels; p++) {
      const alpha = maskData[p * bytesPerMaskPixel] ?? 0
      imageData.data[p * 4 + 3] = alpha
    }
    ctx.putImageData(imageData, 0, 0)

    const outBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
        'image/png',
      )
    })
    return { blob: outBlob, width: canvas.width, height: canvas.height }
  } finally {
    URL.revokeObjectURL(url)
  }
}
