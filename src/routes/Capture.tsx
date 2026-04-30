import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Camera as CameraIcon,
  ImagePlus,
  Sparkles,
  Loader2,
  X,
  Layers,
  AlertCircle,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { processPhoto, type ProcessedPhoto } from '@/lib/photo'
import { removeBackground, type BgRemovalProgress } from '@/lib/bgRemoval'
import {
  detectCategory,
  detectDominantColor,
  ensureClassifierLoaded,
} from '@/lib/detection'
import {
  extractEmbedding,
  findSimilarItems,
  storeItemEmbedding,
  type SimilarItem,
} from '@/lib/embeddings'
import { ItemForm, type ItemFormValues } from '@/components/ItemForm'
import { createItem, getItemPhoto } from '@/db/items'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Item } from '@/db/dexie'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { isIOS, usePrefs } from '@/lib/preferences'

interface VariantState {
  original: ProcessedPhoto
  cutout?: ProcessedPhoto
  cutoutFailed?: boolean
  cutoutError?: string
}

interface DetectedSuggestions {
  category?: string
  color?: string
  /** Display-only — the hex behind the named color, for the swatch chip. */
  colorHex?: string
}

export function Capture() {
  const navigate = useNavigate()
  const mlEnabled = usePrefs((s) => s.mlEnabled)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const [variants, setVariants] = useState<VariantState | null>(null)
  const [showVariant, setShowVariant] = useState<'original' | 'cutout'>(
    'cutout',
  )
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [removalProgress, setRemovalProgress] =
    useState<BgRemovalProgress | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [detected, setDetected] = useState<DetectedSuggestions | null>(null)
  const [detectionError, setDetectionError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  // Visual-duplicate check results. The new item's embedding is computed in
  // background after bg-removal and compared against existing items.
  const [similarItems, setSimilarItems] = useState<SimilarItem[]>([])
  const newItemEmbeddingRef = useRef<Float32Array | null>(null)

  // Each capture (or "Skip") bumps this — any stale ML callbacks check it
  // and bail if their session id no longer matches.
  const sessionIdRef = useRef(0)

  // Tick the elapsed-time counter while ML is running
  useEffect(() => {
    if (!removing && !detecting) {
      setElapsedSec(0)
      return
    }
    const start = Date.now()
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1000))
    }, 250)
    return () => clearInterval(interval)
  }, [removing, detecting])

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
    sessionIdRef.current += 1 // invalidate any in-flight ML
    setVariants(null)
    setShowVariant('cutout')
    setError(null)
    setRemovalProgress(null)
    setRemoving(false)
    setDetected(null)
    setDetecting(false)
    setDetectionError(null)
    setSimilarItems([])
    newItemEmbeddingRef.current = null
  }

  /** User taps "Skip" — drop ML, keep the original photo, show the form. */
  function handleSkipML() {
    sessionIdRef.current += 1
    setRemoving(false)
    setDetecting(false)
    setRemovalProgress(null)
    setShowVariant('original')
    setVariants((prev) =>
      prev
        ? {
            ...prev,
            cutoutFailed: prev.cutoutFailed ?? !prev.cutout,
            cutoutError: prev.cutoutError ?? 'Skipped on this device',
          }
        : prev,
    )
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
      // Skip ML entirely when disabled (default on iOS to avoid memory kills).
      if (mlEnabled) {
        void runPipeline(original)
      } else {
        // Mark cutout as "skipped" so the variant toggle stays sensibly disabled.
        setShowVariant('original')
      }
    } catch (err) {
      console.error(err)
      setError('Could not read that image. Try another.')
      setBusy(false)
    }
  }

  async function runPipeline(original: ProcessedPhoto) {
    const mySession = ++sessionIdRef.current

    // Start CLIP model preload in parallel with bg removal — both will be
    // cached after first run.
    const classifierPreload = ensureClassifierLoaded().catch((err) => {
      console.warn('Classifier preload failed:', err)
      return null
    })

    setRemoving(true)
    let cutout: ProcessedPhoto | undefined
    try {
      const result = await removeBackground(original.blob, (p) => {
        if (sessionIdRef.current !== mySession) return
        setRemovalProgress(p)
      })
      if (sessionIdRef.current !== mySession) return // user skipped or retook
      const url = URL.createObjectURL(result.blob)
      // Pre-decode so the <img> swap is instant — avoids the brief "blank" flash
      // when a freshly-minted Blob URL is set as src and the browser hasn't
      // decoded it yet.
      await new Promise<void>((resolve) => {
        const img = new Image()
        img.onload = () => resolve()
        img.onerror = () => resolve() // don't block on decode errors; render will handle
        img.src = url
      })
      if (sessionIdRef.current !== mySession) {
        URL.revokeObjectURL(url)
        return
      }
      cutout = {
        blob: result.blob,
        width: result.width,
        height: result.height,
        url,
      }
      setVariants((prev) => (prev ? { ...prev, cutout: cutout! } : prev))
      setShowVariant('cutout')
    } catch (err) {
      if (sessionIdRef.current !== mySession) return
      console.error('Background removal failed:', err)
      const message = err instanceof Error ? err.message : String(err)
      setVariants((prev) =>
        prev ? { ...prev, cutoutFailed: true, cutoutError: message } : prev,
      )
      setShowVariant('original')
    } finally {
      if (sessionIdRef.current === mySession) {
        setRemoving(false)
        setRemovalProgress(null)
      }
    }

    if (sessionIdRef.current !== mySession) return

    // Detection runs on cutout if available, original otherwise
    setDetecting(true)
    setDetectionError(null)
    try {
      const sourceBlob = cutout?.blob ?? original.blob
      await classifierPreload
      let categoryErr: unknown
      const [colorResult, categoryResult] = await Promise.all([
        detectDominantColor(sourceBlob).catch((e) => {
          console.warn('Color detection failed:', e)
          return undefined
        }),
        detectCategory(sourceBlob).catch((e) => {
          console.warn('Category detection failed:', e)
          categoryErr = e
          return undefined
        }),
      ])
      if (sessionIdRef.current !== mySession) return
      setDetected({
        category: categoryResult?.label,
        color: colorResult?.name,
        colorHex: colorResult?.hex,
      })
      if (!categoryResult && categoryErr) {
        const msg =
          categoryErr instanceof Error
            ? categoryErr.message
            : String(categoryErr)
        setDetectionError(msg)
      }
    } finally {
      if (sessionIdRef.current === mySession) {
        setDetecting(false)
      }
    }

    if (sessionIdRef.current !== mySession) return

    // Visual duplicate check — runs after detection so we use the same
    // (preferably cutout) source. Failures here are silent: the user can
    // still save the item; they just don't get the warning banner.
    try {
      const sourceBlob = cutout?.blob ?? original.blob
      const emb = await extractEmbedding(sourceBlob)
      if (sessionIdRef.current !== mySession) return
      newItemEmbeddingRef.current = emb
      const matches = await findSimilarItems(sourceBlob, {
        threshold: 0.88,
        limit: 3,
      })
      if (sessionIdRef.current !== mySession) return
      setSimilarItems(matches)
    } catch (err) {
      // Embedding extraction can OOM on iOS or fail mid-load. Don't surface
      // — duplicate detection is best-effort, not blocking.
      console.warn('Duplicate-check embedding failed:', err)
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
      const item = await createItem({
        name: values.name,
        category: values.category,
        color: values.color,
        brand: values.brand,
        purchasePriceMinor:
          values.priceRupees != null ? values.priceRupees * 100 : undefined,
        purchasedAt: values.purchasedAt,
        seedWearCount: values.seedWearCount,
        seedAsOf: values.seedAsOf,
        occasions: values.occasions,
        photo: {
          blob: photoSource.blob,
          width: photoSource.width,
          height: photoSource.height,
          isProcessed,
        },
      })
      // Cache the embedding we already computed so future duplicate checks
      // include this item. Best-effort; failure here doesn't block save.
      if (newItemEmbeddingRef.current) {
        try {
          await storeItemEmbedding(item.id, newItemEmbeddingRef.current)
        } catch (err) {
          console.warn('Could not store embedding:', err)
        }
      }
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
    <div className="px-5 pt-12 max-w-md mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="font-display text-[28px] font-semibold tracking-tight text-ink-50 leading-tight">
          {variants ? 'New item' : 'Add'}
        </h1>
        {variants && (
          <button
            onClick={clearVariants}
            disabled={saving}
            className="text-sm text-ink-300 hover:text-ink-50 disabled:opacity-50"
          >
            Retake
          </button>
        )}
      </header>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-card bg-danger/10 border border-danger/30 text-danger text-sm">
          {error}
        </div>
      )}

      {!variants && (
        <div className="space-y-3">
          <p className="text-tertiary text-[13px] leading-relaxed mb-4">
            Photos and the on-device ML run here — nothing is uploaded.
          </p>

          <button
            onClick={() => cameraInputRef.current?.click()}
            disabled={busy}
            className="w-full h-14 flex items-center justify-center gap-3 rounded-full bg-accent text-ink-950 font-medium active:scale-[0.99] transition-transform disabled:opacity-50"
          >
            <CameraIcon size={20} strokeWidth={1.75} />
            Take a photo
          </button>

          <button
            onClick={() => galleryInputRef.current?.click()}
            disabled={busy}
            className="w-full h-14 flex items-center justify-center gap-3 rounded-full bg-surface-2 border border-hairline text-ink-50 active:scale-[0.99] transition-transform disabled:opacity-50"
          >
            <ImagePlus size={20} strokeWidth={1.75} />
            Pick from gallery
          </button>

          <Link
            to="/capture/bulk"
            className="w-full h-14 flex items-center justify-center gap-3 rounded-full bg-surface-1 border border-hairline text-ink-300 active:scale-[0.99] transition-transform"
          >
            <Layers size={18} strokeWidth={1.75} />
            <span className="text-[15px]">Add many at once</span>
          </Link>

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
              'relative rounded-card overflow-hidden aspect-square flex items-center justify-center border border-hairline',
              showVariant === 'cutout' && variants.cutout
                ? 'bg-checker'
                : 'bg-surface-2',
            )}
          >
            <img
              src={visiblePhoto.url}
              alt="Captured item"
              className="max-h-full max-w-full object-contain"
            />

            {/* Cutout/Original toggle — bottom-center overlay. Only when ML is
                enabled and we actually have a cutout to switch to. */}
            {mlEnabled && variants.cutout && !removing && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1 bg-surface-1/90 backdrop-blur-sm border border-hairline rounded-full">
                <button
                  onClick={() => setShowVariant('cutout')}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                    showVariant === 'cutout'
                      ? 'bg-surface-2 text-ink-50'
                      : 'text-ink-300',
                  )}
                >
                  <Sparkles size={12} strokeWidth={2} />
                  Cutout
                </button>
                <button
                  onClick={() => setShowVariant('original')}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                    showVariant === 'original'
                      ? 'bg-surface-2 text-ink-50'
                      : 'text-ink-300',
                  )}
                >
                  Original
                </button>
              </div>
            )}

            {removing && (
              <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-center px-6">
                <Loader2
                  className="animate-spin text-accent mb-3"
                  size={28}
                  strokeWidth={2}
                />
                <div className="text-sm text-ink-50">
                  {removalProgress?.stage === 'loading-model'
                    ? 'Downloading background-removal model'
                    : 'Removing background'}
                </div>
                {removalProgress?.stage === 'loading-model' && (
                  <>
                    <div className="mt-3 h-1 w-40 bg-surface-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent transition-[width]"
                        style={{ width: `${removalProgress.progress}%` }}
                      />
                    </div>
                    <div className="text-xs text-tertiary mt-2">
                      First-time download · cached after this
                    </div>
                  </>
                )}
                <div className="mt-3 text-[10px] text-tertiary tabular-nums">
                  {elapsedSec}s elapsed
                </div>
                <button
                  type="button"
                  onClick={handleSkipML}
                  className="mt-4 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-2 border border-hairline text-xs text-ink-300 active:scale-95 transition-transform"
                >
                  <X size={12} strokeWidth={1.75} />
                  Skip — use original
                </button>
              </div>
            )}
          </div>

          {/* When ML is off, show a tiny note explaining what's happening */}
          {!mlEnabled && (
            <div className="text-xs text-tertiary">
              Saving photo as-is.{' '}
              {isIOS ? 'On-device ML is off by default on iOS to avoid memory issues. ' : ''}
              <Link to="/settings" className="text-accent">
                Enable in Settings
              </Link>
              .
            </div>
          )}

          {/* Surface bg removal error inline so users can debug without devtools */}
          {variants.cutoutFailed && (
            <div className="px-3 py-2 rounded-card bg-warning/10 border border-warning/30 text-warning text-xs">
              <div className="font-medium">
                Cutout couldn't run — saving original instead.
              </div>
              {variants.cutoutError && (
                <div className="mt-1 text-warning/80 break-words">
                  {variants.cutoutError}
                </div>
              )}
            </div>
          )}

          {/* Auto-detection inline status */}
          {(detecting || detected) && (
            <div className="flex items-center justify-between gap-2 text-xs">
              {detecting ? (
                <div className="flex items-center gap-2 text-ink-300">
                  <Loader2
                    size={12}
                    className="animate-spin text-accent"
                    strokeWidth={2}
                  />
                  <span>
                    Auto-detecting category & color…{' '}
                    <span className="tabular-nums text-tertiary">
                      {elapsedSec}s
                    </span>
                  </span>
                </div>
              ) : detected && (detected.category || detected.color) ? (
                <div className="flex items-center gap-2 text-accent">
                  <Sparkles size={12} strokeWidth={2} />
                  <span>Auto-filled below — edit if wrong.</span>
                </div>
              ) : null}
              {detecting && (
                <button
                  type="button"
                  onClick={handleSkipML}
                  className="text-tertiary hover:text-ink-50"
                >
                  Skip
                </button>
              )}
            </div>
          )}

          {/* Detection error (e.g. CLIP failed to load on iOS) */}
          {detectionError && !detecting && (
            <div className="px-3 py-2 rounded-card bg-warning/10 border border-warning/30 text-warning text-xs">
              <div className="font-medium">
                Auto-detection couldn't run.
              </div>
              <div className="mt-1 text-warning/80 break-words">
                {detectionError}
              </div>
            </div>
          )}

          {/* Visual-duplicate banner — only when we found at least one match */}
          {similarItems.length > 0 && (
            <DuplicateBanner matches={similarItems} />
          )}

          <ItemForm
            onSubmit={handleSave}
            disabled={saving}
            detected={
              detected
                ? {
                    category: detected.category,
                    color: detected.color,
                    colorHex: detected.colorHex,
                  }
                : undefined
            }
          />
        </div>
      )}
    </div>
  )
}

/**
 * Banner shown above the form when the new photo's CLIP embedding closely
 * matches existing items. Doesn't block saving — just makes the user think
 * twice. Threshold of 0.88 cosine reliably catches near-duplicates without
 * spamming on every "I own a few black tops" overlap.
 */
function DuplicateBanner({ matches }: { matches: SimilarItem[] }) {
  return (
    <div className="rounded-card border border-warning/40 bg-warning/10 p-3">
      <div className="flex items-start gap-2 mb-3">
        <AlertCircle
          size={14}
          strokeWidth={2}
          className="text-warning shrink-0 mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] text-warning font-medium">
            You may already own this
          </div>
          <div className="text-[11px] text-warning/80 mt-0.5 leading-snug">
            Close visual match{matches.length > 1 ? 'es' : ''} found in your
            closet. Tap to compare.
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {matches.map((m) => (
          <DuplicateMatchRow key={m.itemId} match={m} />
        ))}
      </div>
    </div>
  )
}

function DuplicateMatchRow({ match }: { match: SimilarItem }) {
  const item = useLiveQuery(
    () => db.items.get(match.itemId) as Promise<Item | undefined>,
    [match.itemId],
  )
  const photo = useLiveQuery(
    () =>
      item?.primaryPhotoId
        ? getItemPhoto(item.primaryPhotoId)
        : Promise.resolve(undefined),
    [item?.primaryPhotoId],
  )
  const [url, setUrl] = useState<string | undefined>()
  useEffect(() => {
    if (!photo?.blob) {
      setUrl(undefined)
      return
    }
    const u = URL.createObjectURL(photo.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [photo?.blob])

  if (!item) return null
  const pct = Math.round(match.score * 100)

  return (
    <Link
      to={`/closet/${item.id}`}
      className="flex items-center gap-3 rounded-card bg-surface-1 border border-hairline px-2.5 py-2 hover:border-warning/40 transition-colors"
    >
      <div className="h-10 w-10 shrink-0 rounded-md overflow-hidden bg-surface-2 flex items-center justify-center">
        {url ? (
          <img
            src={url}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-tertiary text-[10px] text-center px-1">
            {item.name.slice(0, 2)}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-ink-50 truncate">{item.name}</div>
        <div className="text-[11px] text-tertiary truncate">
          {[item.category, item.brand].filter(Boolean).join(' · ') || '—'}
        </div>
      </div>
      <div className="text-[11px] font-semibold tabular-nums text-warning">
        {pct}%
      </div>
    </Link>
  )
}
