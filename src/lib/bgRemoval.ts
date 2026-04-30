/**
 * Background removal via transformers.js + RMBG-1.4 (briaai).
 *
 * Runs entirely in the browser on WebGPU when available, WASM otherwise.
 * Model is downloaded once (~150MB) and cached by transformers.js in IndexedDB.
 *
 * Photos never leave the device.
 */

import { AutoModel, AutoProcessor, RawImage, env } from '@huggingface/transformers'

// Use the Hugging Face CDN for model weights. Models are then cached by
// transformers.js itself (IndexedDB / Cache API) — second run is instant.
env.allowLocalModels = false
// Encourage WebGPU when available (transformers.js v3 falls back to WASM otherwise).
env.backends.onnx.wasm.proxy = false

const MODEL_ID = 'briaai/RMBG-1.4'

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
    const model = await AutoModel.from_pretrained(MODEL_ID, {
      // RMBG-1.4 has a custom architecture; transformers.js will use the included
      // ONNX file directly.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: { model_type: 'custom' } as any,
      progress_callback,
    })
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

/**
 * Remove the background from an image blob. Returns a PNG blob with transparency.
 */
export async function removeBackground(
  inputBlob: Blob,
  onProgress?: (p: BgRemovalProgress) => void,
): Promise<{ blob: Blob; width: number; height: number }> {
  await ensureModelLoaded(onProgress)
  if (!modelPromise) throw new Error('Model failed to load')
  const { model, processor } = await modelPromise

  onProgress?.({ stage: 'processing' })

  const url = URL.createObjectURL(inputBlob)
  try {
    const image = await RawImage.fromURL(url)

    const { pixel_values } = await processor(image)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const output = (await model({ input: pixel_values })) as any

    // RMBG outputs a single-channel mask. Some builds expose it as `output`,
    // others return a tensor directly.
    const tensor = output.output ?? output[0] ?? output
    const maskTensor = Array.isArray(tensor) ? tensor[0] : tensor
    const maskRaw = await RawImage.fromTensor(maskTensor.mul(255).to('uint8'))
    const mask = await maskRaw.resize(image.width, image.height)

    // Composite: copy original RGB, set alpha from mask grayscale.
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')

    const bitmap = await createImageBitmap(inputBlob)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const maskData = mask.data as Uint8Array
    for (let i = 0; i < imageData.data.length / 4; i++) {
      // Mask is grayscale (single channel). Use it as alpha.
      const alpha = maskData[i] ?? 0
      imageData.data[i * 4 + 3] = alpha
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
