import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Loader2,
  ImagePlus,
  X,
  Sparkles,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react'
import { processPhoto, type ProcessedPhoto } from '@/lib/photo'
import { removeBackground } from '@/lib/bgRemoval'
import {
  detectCategory,
  detectDominantColor,
  ensureClassifierLoaded,
} from '@/lib/detection'
import { createItem } from '@/db/items'
import { CATEGORIES } from '@/components/ItemForm'
import { toast } from '@/lib/toast'
import { cn, makeId } from '@/lib/utils'
import { usePrefs } from '@/lib/preferences'

type Status =
  | 'queued'
  | 'processing-bg'
  | 'processing-detect'
  | 'ready'
  | 'failed'

interface BulkItem {
  id: string
  original: ProcessedPhoto
  cutout?: ProcessedPhoto
  cutoutFailed?: boolean
  status: Status
  // Editable fields
  name: string
  category: string
  color: string
  detectedColorHex?: string
  // Marks fields filled by auto-detection so the UI can hint without
  // overwriting user edits later.
  detectedFlags: { category: boolean; color: boolean }
}

const MAX_ITEMS = 30

export function BulkCapture() {
  const navigate = useNavigate()
  const mlEnabled = usePrefs((s) => s.mlEnabled)
  const fileRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<BulkItem[]>([])
  const [adding, setAdding] = useState(false)
  const [savingProgress, setSavingProgress] = useState<{
    done: number
    total: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Keep a ref in sync so the sequential pipeline reads fresh state without
  // re-creating itself when items mutate.
  const itemsRef = useRef<BulkItem[]>([])
  itemsRef.current = items

  const pipelineRunning = useRef(false)
  // Bumped when the user navigates away — pipeline checks before mutating.
  const sessionIdRef = useRef(0)

  // Cleanup blob URLs on unmount
  useEffect(() => {
    const session = ++sessionIdRef.current
    return () => {
      if (sessionIdRef.current === session) sessionIdRef.current++
      itemsRef.current.forEach((it) => {
        URL.revokeObjectURL(it.original.url)
        if (it.cutout) URL.revokeObjectURL(it.cutout.url)
      })
    }
  }, [])

  function patchItem(id: string, patch: Partial<BulkItem>) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    )
  }

  async function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setError(null)

    const remaining = MAX_ITEMS - items.length
    if (remaining <= 0) {
      setError(
        `You can stage up to ${MAX_ITEMS} items at a time. Save these first to add more.`,
      )
      return
    }
    const toProcess = files.slice(0, remaining)
    if (files.length > remaining) {
      setError(
        `Only the first ${remaining} were added — limit is ${MAX_ITEMS} per batch.`,
      )
    }

    setAdding(true)
    const newItems: BulkItem[] = []
    let readFailures = 0
    for (const file of toProcess) {
      try {
        const original = await processPhoto(file)
        newItems.push({
          id: makeId('bulk'),
          original,
          status: mlEnabled ? 'queued' : 'ready',
          name: '',
          category: '',
          color: '',
          detectedFlags: { category: false, color: false },
        })
      } catch (err) {
        console.warn('Failed to process file', file.name, err)
        readFailures++
      }
    }
    if (readFailures > 0) {
      setError(
        `${readFailures} photo${readFailures > 1 ? 's' : ''} couldn't be read and ${readFailures > 1 ? 'were' : 'was'} skipped.`,
      )
    }
    setItems((prev) => [...prev, ...newItems])
    setAdding(false)

    if (mlEnabled) void runPipeline()
  }

  async function runPipeline() {
    if (pipelineRunning.current) return
    pipelineRunning.current = true
    const mySession = sessionIdRef.current
    try {
      // Kick off classifier preload in parallel — first item pays the model
      // download, the rest get cache hits.
      void ensureClassifierLoaded().catch(() => null)

      while (true) {
        if (sessionIdRef.current !== mySession) return
        const next = itemsRef.current.find((it) => it.status === 'queued')
        if (!next) break
        await processOne(next.id, mySession)
      }
    } finally {
      pipelineRunning.current = false
    }
  }

  async function processOne(itemId: string, mySession: number) {
    if (sessionIdRef.current !== mySession) return
    const start = itemsRef.current.find((x) => x.id === itemId)
    if (!start) return

    patchItem(itemId, { status: 'processing-bg' })
    let cutout: ProcessedPhoto | undefined
    try {
      const result = await removeBackground(start.original.blob)
      if (sessionIdRef.current !== mySession) return
      // If the user removed this item while bg removal was running, drop the
      // result on the floor.
      const stillExists = itemsRef.current.some((x) => x.id === itemId)
      if (!stillExists) return
      const url = URL.createObjectURL(result.blob)
      cutout = {
        blob: result.blob,
        width: result.width,
        height: result.height,
        url,
      }
      patchItem(itemId, { cutout, status: 'processing-detect' })
    } catch (err) {
      if (sessionIdRef.current !== mySession) return
      console.warn('bulk: bg removal failed', err)
      patchItem(itemId, {
        cutoutFailed: true,
        status: 'processing-detect',
      })
    }

    if (sessionIdRef.current !== mySession) return
    const stillExists = itemsRef.current.some((x) => x.id === itemId)
    if (!stillExists) return

    const sourceBlob = cutout?.blob ?? start.original.blob
    try {
      const [colorResult, categoryResult] = await Promise.all([
        detectDominantColor(sourceBlob).catch(() => undefined),
        detectCategory(sourceBlob).catch(() => undefined),
      ])
      if (sessionIdRef.current !== mySession) return
      const current = itemsRef.current.find((x) => x.id === itemId)
      if (!current) return

      const patch: Partial<BulkItem> = { status: 'ready' }
      const flags = { ...current.detectedFlags }
      if (categoryResult?.label && !current.category) {
        patch.category = categoryResult.label
        flags.category = true
      }
      if (colorResult?.name && !current.color) {
        patch.color = colorResult.name
        flags.color = true
      }
      if (colorResult?.hex) patch.detectedColorHex = colorResult.hex
      // Default name to the detected category when the user hasn't typed
      // anything — friction killer for bulk add.
      if (categoryResult?.label && !current.name) {
        patch.name = categoryResult.label
      }
      patch.detectedFlags = flags
      patchItem(itemId, patch)
    } catch (err) {
      if (sessionIdRef.current !== mySession) return
      console.warn('bulk: detection failed', err)
      patchItem(itemId, { status: 'ready' })
    }
  }

  function removeItem(id: string) {
    const it = items.find((x) => x.id === id)
    if (it) {
      URL.revokeObjectURL(it.original.url)
      if (it.cutout) URL.revokeObjectURL(it.cutout.url)
    }
    setItems((prev) => prev.filter((x) => x.id !== id))
  }

  async function handleSaveAll() {
    if (items.length === 0) return
    const missing = items.filter((it) => !it.name.trim())
    if (missing.length > 0) {
      setError(
        `${missing.length} item${missing.length > 1 ? 's' : ''} need${missing.length > 1 ? '' : 's'} a name before saving.`,
      )
      return
    }
    setError(null)
    setSavingProgress({ done: 0, total: items.length })
    let done = 0
    let failed = 0
    for (const it of items) {
      try {
        const photoSource = it.cutout ?? it.original
        await createItem({
          name: it.name.trim(),
          category: it.category || undefined,
          color: it.color.trim() || undefined,
          photo: {
            blob: photoSource.blob,
            width: photoSource.width,
            height: photoSource.height,
            isProcessed: photoSource === it.cutout,
          },
        })
        done++
      } catch (err) {
        console.error('bulk: save failed for', it.name, err)
        failed++
      }
      setSavingProgress({ done: done + failed, total: items.length })
    }
    items.forEach((it) => {
      URL.revokeObjectURL(it.original.url)
      if (it.cutout) URL.revokeObjectURL(it.cutout.url)
    })
    if (failed === 0) {
      toast.success(`Added ${done} item${done !== 1 ? 's' : ''} to closet`)
    } else {
      toast.success(
        `Added ${done} · ${failed} failed`,
      )
    }
    navigate('/closet')
  }

  const processingCount = items.filter(
    (it) =>
      it.status === 'processing-bg' ||
      it.status === 'processing-detect' ||
      it.status === 'queued',
  ).length
  const allReady = items.length > 0 && processingCount === 0

  return (
    <div className="px-4 pt-12 pb-32 max-w-md mx-auto">
      <header className="flex items-center gap-2 mb-6">
        <Link
          to="/capture"
          aria-label="Back to single capture"
          className="-ml-2 p-2 text-ink-400 hover:text-ink-100"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold leading-tight">Bulk add</h1>
          <p className="text-xs text-ink-500 mt-0.5">
            Pick up to {MAX_ITEMS} photos · review and save in one go
          </p>
        </div>
      </header>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFiles}
        className="hidden"
      />

      {items.length === 0 ? (
        <div className="space-y-3">
          <p className="text-ink-400 text-sm leading-relaxed">
            Pick multiple photos at once. Category and color are auto-detected
            on this device — you just review names, then save the whole batch.
            Photos never leave your phone.
          </p>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={adding}
            className="w-full flex items-center justify-center gap-2 px-4 py-4 rounded-2xl bg-accent text-ink-950 font-medium active:scale-[0.99] transition disabled:opacity-50"
          >
            {adding ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <ImagePlus size={20} />
            )}
            {adding ? 'Reading photos…' : 'Pick photos from gallery'}
          </button>
          {!mlEnabled && (
            <p className="text-xs text-ink-500">
              On-device ML is off — photos will save as-is.{' '}
              <Link to="/settings" className="text-accent">
                Enable in Settings
              </Link>
              .
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-ink-500">
            <span>
              {items.length} item{items.length !== 1 ? 's' : ''}
              {processingCount > 0 && (
                <> · {processingCount} processing</>
              )}
            </span>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={adding || items.length >= MAX_ITEMS}
              className="text-accent hover:text-accent/80 disabled:opacity-40"
            >
              + Add more
            </button>
          </div>

          {items.map((it) => (
            <BulkRow
              key={it.id}
              item={it}
              onChange={(patch) => patchItem(it.id, patch)}
              onRemove={() => removeItem(it.id)}
            />
          ))}
        </div>
      )}

      {/* Sticky save bar — sits above the tab bar */}
      {items.length > 0 && (
        <div
          className="fixed inset-x-0 bottom-16 z-40 px-4 pt-3 pb-2 bg-gradient-to-t from-ink-950 via-ink-950/95 to-ink-950/0"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
        >
          <div className="max-w-md mx-auto">
            <button
              onClick={handleSaveAll}
              disabled={savingProgress !== null}
              className="w-full px-4 py-3 rounded-2xl bg-accent text-ink-950 font-medium active:scale-[0.99] transition disabled:opacity-40"
            >
              {savingProgress
                ? `Saving ${savingProgress.done} / ${savingProgress.total}…`
                : !allReady
                  ? `Save ${items.length} now (${processingCount} still processing)`
                  : `Save ${items.length} to closet`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function BulkRow({
  item,
  onChange,
  onRemove,
}: {
  item: BulkItem
  onChange: (patch: Partial<BulkItem>) => void
  onRemove: () => void
}) {
  const photo = item.cutout ?? item.original
  const isCutout = photo === item.cutout

  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-900/50 p-3">
      <div className="flex gap-3">
        <div
          className={cn(
            'relative w-20 h-20 rounded-xl overflow-hidden flex items-center justify-center shrink-0',
            isCutout
              ? 'bg-[image:repeating-conic-gradient(theme(colors.ink.800)_0%_25%,theme(colors.ink.900)_0%_50%)] bg-[length:12px_12px]'
              : 'bg-ink-800',
          )}
        >
          <img
            src={photo.url}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
          {(item.status === 'processing-bg' ||
            item.status === 'processing-detect' ||
            item.status === 'queued') && (
            <div className="absolute inset-0 bg-ink-950/60 flex items-center justify-center">
              <Loader2 size={18} className="animate-spin text-accent" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start gap-1">
            <input
              value={item.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="Name"
              className="form-input"
            />
            <button
              onClick={onRemove}
              aria-label="Remove"
              className="p-2 -mr-1 -mt-1 text-ink-500 hover:text-ink-100"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={item.category}
              onChange={(e) =>
                onChange({
                  category: e.target.value,
                  detectedFlags: { ...item.detectedFlags, category: false },
                })
              }
              className="form-input text-xs"
            >
              <option value="">Category…</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="relative">
              {item.detectedColorHex && item.detectedFlags.color && (
                <span
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full border border-ink-700"
                  style={{ backgroundColor: item.detectedColorHex }}
                  aria-hidden
                />
              )}
              <input
                value={item.color}
                onChange={(e) =>
                  onChange({
                    color: e.target.value,
                    detectedFlags: { ...item.detectedFlags, color: false },
                  })
                }
                placeholder="Color"
                className={cn(
                  'form-input text-xs',
                  item.detectedColorHex && item.detectedFlags.color && 'pl-7',
                )}
              />
            </div>
          </div>
        </div>
      </div>

      {item.cutoutFailed && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-300/80">
          <AlertCircle size={11} />
          <span>Cutout failed — will save original</span>
        </div>
      )}
      {item.status === 'ready' &&
        (item.detectedFlags.category || item.detectedFlags.color) && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-accent/70">
            <Sparkles size={11} />
            <span>Auto-filled — edit if wrong</span>
          </div>
        )}
    </div>
  )
}
