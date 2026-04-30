import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera as CameraIcon, ImagePlus, Sparkles, Loader2 } from 'lucide-react'
import { processPhoto, type ProcessedPhoto } from '@/lib/photo'
import { removeBackground, type BgRemovalProgress } from '@/lib/bgRemoval'
import { ItemForm, type ItemFormValues } from '@/components/ItemForm'
import { createItem } from '@/db/items'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

interface VariantState {
  original: ProcessedPhoto
  cutout?: ProcessedPhoto
  cutoutFailed?: boolean
}

export function Capture() {
  const navigate = useNavigate()
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const [variants, setVariants] = useState<VariantState | null>(null)
  const [showVariant, setShowVariant] = useState<'original' | 'cutout'>('cutout')
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [removalProgress, setRemovalProgress] =
    useState<BgRemovalProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Cleanup any object URLs when unmounting
  useEffect(() => {
    return () => {
      if (variants?.original) URL.revokeObjectURL(variants.original.url)
      if (variants?.cutout) URL.revokeObjectURL(variants.cutout.url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function clearVariants() {
    if (variants?.original) URL.revokeObjectURL(variants.original.url)
    if (variants?.cutout) URL.revokeObjectURL(variants.cutout.url)
    setVariants(null)
    setShowVariant('cutout')
    setError(null)
    setRemovalProgress(null)
    setRemoving(false)
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    clearVariants()
    setBusy(true)
    try {
      const original = await processPhoto(file)
      setVariants({ original })
      setBusy(false)
      // Kick off bg removal in the background
      runBgRemoval(original)
    } catch (err) {
      console.error(err)
      setError('Could not read that image. Try another.')
      setBusy(false)
    }
  }

  async function runBgRemoval(original: ProcessedPhoto) {
    setRemoving(true)
    try {
      const { blob, width, height } = await removeBackground(
        original.blob,
        (p) => setRemovalProgress(p),
      )
      const url = URL.createObjectURL(blob)
      setVariants((prev) =>
        prev
          ? {
              ...prev,
              cutout: { blob, width, height, url },
            }
          : prev,
      )
      setShowVariant('cutout')
    } catch (err) {
      console.error('Background removal failed:', err)
      setVariants((prev) => (prev ? { ...prev, cutoutFailed: true } : prev))
      setShowVariant('original')
    } finally {
      setRemoving(false)
      setRemovalProgress(null)
    }
  }

  async function handleSave(values: ItemFormValues) {
    if (!variants) return
    const photoSource =
      showVariant === 'cutout' && variants.cutout
        ? variants.cutout
        : variants.original
    const isProcessed = photoSource === variants.cutout

    setSaving(true)
    setError(null)
    try {
      await createItem({
        name: values.name,
        category: values.category,
        color: values.color,
        brand: values.brand,
        purchasePriceMinor:
          values.priceRupees != null ? values.priceRupees * 100 : undefined,
        purchasedAt: values.purchasedAt,
        photo: {
          blob: photoSource.blob,
          width: photoSource.width,
          height: photoSource.height,
          isProcessed,
        },
      })
      clearVariants()
      toast.success(`Saved "${values.name}" to closet`)
      navigate('/closet')
    } catch (err) {
      console.error(err)
      setError('Could not save. Try again.')
      setSaving(false)
    }
  }

  const visiblePhoto =
    showVariant === 'cutout' && variants?.cutout
      ? variants.cutout
      : variants?.original

  return (
    <div className="px-4 pt-12 max-w-md mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">
          {variants ? 'New item' : 'Add an item'}
        </h1>
        {variants && (
          <button
            onClick={clearVariants}
            disabled={saving}
            className="text-sm text-ink-400 hover:text-ink-100 disabled:opacity-50"
          >
            Retake
          </button>
        )}
      </header>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      {!variants && (
        <div className="space-y-3">
          <p className="text-ink-400 text-sm leading-relaxed mb-2">
            Photograph an item or pick one from your gallery. Photos and the
            background-removal model run on this device — nothing is uploaded.
          </p>

          <button
            onClick={() => cameraInputRef.current?.click()}
            disabled={busy}
            className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl bg-accent text-ink-950 font-medium active:scale-[0.99] transition disabled:opacity-50"
          >
            <CameraIcon size={20} />
            Take a photo
          </button>

          <button
            onClick={() => galleryInputRef.current?.click()}
            disabled={busy}
            className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl bg-ink-800 border border-ink-700 text-ink-100 active:scale-[0.99] transition disabled:opacity-50"
          >
            <ImagePlus size={20} />
            Pick from gallery
          </button>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            className="hidden"
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
        </div>
      )}

      {variants && visiblePhoto && (
        <div className="space-y-4">
          <div
            className={cn(
              'relative rounded-2xl overflow-hidden aspect-square flex items-center justify-center',
              showVariant === 'cutout' && variants.cutout
                ? 'bg-[image:repeating-conic-gradient(theme(colors.ink.800)_0%_25%,theme(colors.ink.900)_0%_50%)] bg-[length:24px_24px]'
                : 'bg-ink-800',
            )}
          >
            <img
              src={visiblePhoto.url}
              alt="Captured item"
              className="max-h-full max-w-full object-contain"
            />
            {removing && (
              <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm flex flex-col items-center justify-center text-center px-6">
                <Loader2
                  className="animate-spin text-accent mb-3"
                  size={28}
                />
                <div className="text-sm text-ink-100">
                  {removalProgress?.stage === 'loading-model'
                    ? 'Downloading background-removal model'
                    : 'Removing background'}
                </div>
                {removalProgress?.stage === 'loading-model' && (
                  <>
                    <div className="mt-3 h-1.5 w-40 bg-ink-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent transition-[width]"
                        style={{ width: `${removalProgress.progress}%` }}
                      />
                    </div>
                    <div className="text-xs text-ink-400 mt-2">
                      First-time download · cached after this
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Variant toggle */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1 bg-ink-800 rounded-full p-1">
              <button
                onClick={() => setShowVariant('cutout')}
                disabled={!variants.cutout || removing}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition disabled:opacity-40',
                  showVariant === 'cutout'
                    ? 'bg-ink-700 text-ink-50'
                    : 'text-ink-400',
                )}
              >
                <Sparkles size={12} className="inline mr-1 -mt-0.5" />
                Cutout
              </button>
              <button
                onClick={() => setShowVariant('original')}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition',
                  showVariant === 'original'
                    ? 'bg-ink-700 text-ink-50'
                    : 'text-ink-400',
                )}
              >
                Original
              </button>
            </div>
            {variants.cutoutFailed && (
              <div className="text-xs text-ink-400">
                Cutout failed · using original
              </div>
            )}
          </div>

          <ItemForm onSubmit={handleSave} disabled={saving} />
        </div>
      )}
    </div>
  )
}
