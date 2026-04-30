import { useParams, useNavigate, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import {
  ArrowLeft,
  Pencil,
  Archive,
  ArchiveRestore,
  ImagePlus,
  Loader2,
  Sparkles,
  Check,
  CalendarPlus,
  Trash2,
} from 'lucide-react'
import { db } from '@/db/dexie'
import {
  archiveItem,
  getItemPhoto,
  replaceItemPhoto,
  unarchiveItem,
  updateItem,
} from '@/db/items'
import {
  deleteWear,
  listWearsForItem,
  logWear,
} from '@/db/wears'
import { ItemForm, type ItemFormValues } from '@/components/ItemForm'
import { processPhoto } from '@/lib/photo'
import { removeBackground, type BgRemovalProgress } from '@/lib/bgRemoval'
import { toast } from '@/lib/toast'
import {
  startOfDay,
  isSameDay,
  relativeDayLabel,
  shortDate,
} from '@/lib/dates'

export function ItemDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const item = useLiveQuery(
    () => (id ? db.items.get(id) : undefined),
    [id],
  )
  const photo = useLiveQuery(
    () =>
      item?.primaryPhotoId
        ? getItemPhoto(item.primaryPhotoId)
        : Promise.resolve(undefined),
    [item?.primaryPhotoId],
  )
  const wears = useLiveQuery(
    () => (id ? listWearsForItem(id) : Promise.resolve([])),
    [id],
  )

  const [url, setUrl] = useState<string | undefined>()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [replacing, setReplacing] = useState(false)
  const [replacingProgress, setReplacingProgress] =
    useState<BgRemovalProgress | null>(null)

  useEffect(() => {
    if (!photo?.blob) {
      setUrl(undefined)
      return
    }
    const u = URL.createObjectURL(photo.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [photo?.blob])

  if (item === undefined) {
    return <div className="px-4 pt-12 text-ink-400">Loading…</div>
  }

  if (!item) {
    return (
      <div className="px-4 pt-12 max-w-md mx-auto">
        <p className="text-ink-300">Item not found.</p>
        <Link to="/closet" className="text-accent text-sm">
          Back to closet
        </Link>
      </div>
    )
  }

  const today = startOfDay()
  const wornToday = wears?.some((w) => isSameDay(w.wornAt, today)) ?? false
  const wearCount = wears?.length ?? 0
  const lastWornAt = wears?.[0]?.wornAt
  const cpw =
    item.purchasePriceMinor != null && wearCount > 0
      ? item.purchasePriceMinor / 100 / wearCount
      : undefined

  async function handleSaveEdit(values: ItemFormValues) {
    setBusy(true)
    setError(null)
    try {
      await updateItem(item!.id, {
        name: values.name,
        category: values.category,
        color: values.color,
        brand: values.brand,
        purchasePriceMinor:
          values.priceRupees != null ? values.priceRupees * 100 : undefined,
        purchasedAt: values.purchasedAt,
      })
      setEditing(false)
      toast.success('Item updated')
    } catch (err) {
      console.error(err)
      setError('Could not save changes.')
    } finally {
      setBusy(false)
    }
  }

  async function handleArchiveToggle() {
    if (!item) return
    setBusy(true)
    try {
      if (item.archivedAt) {
        await unarchiveItem(item.id)
        toast.success('Restored from archive')
      } else {
        await archiveItem(item.id)
        toast.info('Archived')
      }
    } catch (err) {
      console.error(err)
      setError('Could not update archive state.')
    } finally {
      setBusy(false)
    }
  }

  async function handleReplacePhoto(e: ChangeEvent<HTMLInputElement>) {
    if (!item) return
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setReplacing(true)
    setError(null)
    try {
      const original = await processPhoto(file)
      try {
        const cutout = await removeBackground(original.blob, (p) =>
          setReplacingProgress(p),
        )
        URL.revokeObjectURL(original.url)
        await replaceItemPhoto(
          item.id,
          cutout.blob,
          cutout.width,
          cutout.height,
          true,
        )
      } catch (bgErr) {
        console.error('bg removal failed, saving original:', bgErr)
        await replaceItemPhoto(
          item.id,
          original.blob,
          original.width,
          original.height,
          false,
        )
        URL.revokeObjectURL(original.url)
      }
      toast.success('Photo replaced')
    } catch (err) {
      console.error(err)
      setError('Could not replace photo.')
    } finally {
      setReplacing(false)
      setReplacingProgress(null)
    }
  }

  async function handleWearToday() {
    if (!item) return
    setBusy(true)
    try {
      const todayWear = wears?.find((w) => isSameDay(w.wornAt, today))
      if (todayWear) {
        await deleteWear(todayWear.id)
        toast.info('Removed from today')
      } else {
        await logWear({ itemId: item.id })
        toast.success('Logged for today')
      }
    } catch (err) {
      console.error(err)
      setError('Could not update wear.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-md mx-auto pb-8">
      <header className="px-4 pt-12 pb-4 flex items-center justify-between">
        <button
          onClick={() => (editing ? setEditing(false) : navigate(-1))}
          className="p-2 -ml-2 rounded-lg text-ink-300 hover:text-ink-50"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-1">
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="p-2 rounded-lg text-ink-300 hover:text-ink-50"
              aria-label="Edit"
            >
              <Pencil size={18} />
            </button>
          )}
          <button
            onClick={handleArchiveToggle}
            disabled={busy}
            className="p-2 rounded-lg text-ink-300 hover:text-ink-50 disabled:opacity-50"
            aria-label={item.archivedAt ? 'Unarchive' : 'Archive'}
            title={item.archivedAt ? 'Unarchive' : 'Archive'}
          >
            {item.archivedAt ? (
              <ArchiveRestore size={18} />
            ) : (
              <Archive size={18} />
            )}
          </button>
        </div>
      </header>

      {error && (
        <div className="mx-4 mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      {item.archivedAt && (
        <div className="mx-4 mb-4 px-3 py-2 rounded-xl bg-ink-800 border border-ink-700 text-ink-300 text-xs flex items-center gap-2">
          <Archive size={14} />
          Archived on {new Date(item.archivedAt).toLocaleDateString('en-IN')}
        </div>
      )}

      <div className="px-4">
        <div
          className={
            'relative rounded-2xl overflow-hidden aspect-square flex items-center justify-center ' +
            (photo?.isProcessed
              ? 'bg-[image:repeating-conic-gradient(theme(colors.ink.800)_0%_25%,theme(colors.ink.900)_0%_50%)] bg-[length:24px_24px]'
              : 'bg-ink-800')
          }
        >
          {url ? (
            <img
              src={url}
              alt={item.name}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <div className="text-ink-500">No photo</div>
          )}
          {replacing && (
            <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm flex flex-col items-center justify-center text-center px-6">
              <Loader2 className="animate-spin text-accent mb-3" size={24} />
              <div className="text-sm text-ink-100">
                {replacingProgress?.stage === 'loading-model'
                  ? 'Downloading model'
                  : 'Removing background'}
              </div>
            </div>
          )}
          {!editing && !replacing && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-2 right-2 p-2 rounded-full bg-ink-900/80 border border-ink-700 text-ink-100 backdrop-blur active:scale-95 transition"
              aria-label="Replace photo"
              title="Replace photo"
            >
              <ImagePlus size={16} />
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleReplacePhoto}
            className="hidden"
          />
        </div>

        {photo?.isProcessed && (
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink-400">
            <Sparkles size={12} className="text-accent" />
            Background removed on this device
          </div>
        )}

        {editing ? (
          <div className="mt-6">
            <ItemForm
              onSubmit={handleSaveEdit}
              disabled={busy}
              submitLabel="Save changes"
              initial={{
                name: item.name,
                category: item.category,
                color: item.color,
                brand: item.brand,
                priceRupees:
                  item.purchasePriceMinor != null
                    ? item.purchasePriceMinor / 100
                    : undefined,
                purchasedAt: item.purchasedAt,
              }}
            />
          </div>
        ) : (
          <>
            <div className="mt-6">
              <h1 className="text-2xl font-semibold">{item.name}</h1>
              {item.category && (
                <div className="mt-1 text-sm text-ink-400">{item.category}</div>
              )}
            </div>

            {/* Wear-today CTA */}
            <button
              onClick={handleWearToday}
              disabled={busy || !!item.archivedAt}
              className={
                'mt-5 w-full px-4 py-3 rounded-2xl font-medium flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-50 ' +
                (wornToday
                  ? 'bg-ink-800 border border-accent text-accent'
                  : 'bg-accent text-ink-950')
              }
            >
              {wornToday ? (
                <>
                  <Check size={18} />
                  Worn today
                </>
              ) : (
                <>
                  <CalendarPlus size={18} />
                  I wore this today
                </>
              )}
            </button>

            {/* Wear stats */}
            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              <Stat label="Wears" value={String(wearCount)} />
              <Stat
                label="Last worn"
                value={
                  lastWornAt ? relativeDayLabel(lastWornAt) : '—'
                }
              />
              <Stat
                label="Cost / wear"
                value={
                  cpw != null
                    ? `₹${Math.round(cpw).toLocaleString('en-IN')}`
                    : '—'
                }
              />
            </div>

            {/* Item metadata */}
            <dl className="mt-6 space-y-3 text-sm">
              {item.brand && <Row label="Brand" value={item.brand} />}
              {item.color && <Row label="Color" value={item.color} />}
              {item.purchasePriceMinor != null && (
                <Row
                  label="Price"
                  value={`₹${(item.purchasePriceMinor / 100).toLocaleString(
                    'en-IN',
                  )}`}
                />
              )}
              {item.purchasedAt && (
                <Row
                  label="Purchased"
                  value={new Date(item.purchasedAt).toLocaleDateString(
                    'en-IN',
                    { dateStyle: 'medium' },
                  )}
                />
              )}
              <Row
                label="Added"
                value={new Date(item.createdAt).toLocaleDateString('en-IN', {
                  dateStyle: 'medium',
                })}
              />
              {item.source && item.source !== 'manual' && (
                <Row label="Source" value={item.source} />
              )}
            </dl>

            {/* Wear history */}
            {wears && wears.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-medium text-ink-100 mb-3">
                  Wear history
                </h3>
                <ul className="divide-y divide-ink-800">
                  {wears.slice(0, 20).map((w) => (
                    <li
                      key={w.id}
                      className="py-2 flex items-center justify-between text-sm"
                    >
                      <div>
                        <div className="text-ink-100">
                          {relativeDayLabel(w.wornAt)}
                        </div>
                        <div className="text-xs text-ink-500">
                          {shortDate(w.wornAt)}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteWear(w.id)}
                        className="p-1.5 rounded-lg text-ink-500 hover:text-red-400"
                        aria-label="Remove wear"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
                {wears.length > 20 && (
                  <div className="mt-2 text-xs text-ink-500">
                    + {wears.length - 20} more
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-ink-800 pb-2">
      <dt className="text-ink-400">{label}</dt>
      <dd className="text-ink-100">{value}</dd>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-ink-800 border border-ink-800 px-3 py-3">
      <div className="text-xs text-ink-400">{label}</div>
      <div className="mt-0.5 text-base font-medium truncate">{value}</div>
    </div>
  )
}
