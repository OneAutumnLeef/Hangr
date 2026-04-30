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
  History,
  Plus,
  X,
  Tag,
  Palette,
  Store,
  Calendar,
  IndianRupee,
} from 'lucide-react'
import { db, type ArchivedReason } from '@/db/dexie'
import {
  archiveItem,
  getItemPhoto,
  replaceItemPhoto,
  unarchiveItem,
  updateItem,
} from '@/db/items'
import { deleteWear, listWearsForItem, logWear } from '@/db/wears'
import { ItemForm, type ItemFormValues } from '@/components/ItemForm'
import { ArchiveDialog } from '@/components/ArchiveDialog'
import { MetadataPill } from '@/components/MetadataPill'
import { processPhoto } from '@/lib/photo'
import { removeBackground, type BgRemovalProgress } from '@/lib/bgRemoval'
import { toast } from '@/lib/toast'
import {
  startOfDay,
  isSameDay,
  relativeDayLabel,
  shortDate,
} from '@/lib/dates'
import { cn } from '@/lib/utils'

const ARCHIVED_REASON_LABELS: Record<ArchivedReason, string> = {
  donated: 'Donated',
  sold: 'Sold',
  gifted: 'Gave away',
  lost: 'Lost',
  damaged: 'Damaged',
  replaced: 'Replaced',
  outgrown: 'Outgrown',
  unworn: 'Just don’t wear',
  other: 'Other',
}

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
  const [archiveOpen, setArchiveOpen] = useState(false)
  // Backdate inline picker
  const [backdateOpen, setBackdateOpen] = useState(false)
  const [backdateValue, setBackdateValue] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  )

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
    return <div className="px-5 pt-12 text-tertiary">Loading…</div>
  }

  if (!item) {
    return (
      <div className="px-5 pt-12 max-w-md mx-auto">
        <p className="text-ink-300">Item not found.</p>
        <Link to="/closet" className="text-accent text-sm">
          Back to closet
        </Link>
      </div>
    )
  }

  const today = startOfDay()
  const wornToday = wears?.some((w) => isSameDay(w.wornAt, today)) ?? false
  const realWearCount = wears?.length ?? 0
  const seedWearCount = item.seedWearCount ?? 0
  const totalWearCount = realWearCount + seedWearCount
  const lastRealWornAt = wears?.[0]?.wornAt
  const cpw =
    item.purchasePriceMinor != null && totalWearCount > 0
      ? item.purchasePriceMinor / 100 / totalWearCount
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
        seedWearCount: values.seedWearCount,
        seedAsOf: values.seedAsOf,
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

  async function handleArchiveConfirm(
    reason: ArchivedReason | undefined,
    note?: string,
  ) {
    if (!item) return
    setBusy(true)
    try {
      await archiveItem(item.id, reason, note)
      setArchiveOpen(false)
      toast.info('Archived')
    } catch (err) {
      console.error(err)
      setError('Could not archive.')
    } finally {
      setBusy(false)
    }
  }

  async function handleUnarchive() {
    if (!item) return
    setBusy(true)
    try {
      await unarchiveItem(item.id)
      toast.success('Restored from archive')
    } catch (err) {
      console.error(err)
      setError('Could not restore.')
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

  async function handleBackdateSubmit() {
    if (!item || !backdateValue) return
    const ts = startOfDay(new Date(backdateValue).getTime())
    if (Number.isNaN(ts)) return
    if (ts > today) {
      toast.error('Pick a date in the past')
      return
    }
    setBusy(true)
    try {
      // Avoid duplicates on the chosen day
      const existing = wears?.find((w) => isSameDay(w.wornAt, ts))
      if (existing) {
        toast.info('Already logged for that day')
      } else {
        await logWear({
          itemId: item.id,
          wornAt: ts,
          source: 'backdated',
        })
        toast.success(`Logged for ${shortDate(ts)}`)
      }
      setBackdateOpen(false)
    } catch (err) {
      console.error(err)
      setError('Could not log past wear.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-md mx-auto pb-8 relative">
      {/* Floating header — circle buttons overlay the photo */}
      <header className="absolute top-0 left-0 right-0 px-4 pt-12 pb-4 z-20 flex items-center justify-between">
        <CircleButton
          onClick={() => (editing ? setEditing(false) : navigate(-1))}
          ariaLabel="Back"
        >
          <ArrowLeft size={18} strokeWidth={1.75} />
        </CircleButton>
        <div className="flex items-center gap-2">
          {!editing && (
            <CircleButton onClick={() => setEditing(true)} ariaLabel="Edit">
              <Pencil size={16} strokeWidth={1.75} />
            </CircleButton>
          )}
          {item.archivedAt ? (
            <CircleButton
              onClick={handleUnarchive}
              disabled={busy}
              ariaLabel="Unarchive"
            >
              <ArchiveRestore size={16} strokeWidth={1.75} />
            </CircleButton>
          ) : (
            <CircleButton
              onClick={() => setArchiveOpen(true)}
              disabled={busy}
              ariaLabel="Archive"
            >
              <Archive size={16} strokeWidth={1.75} />
            </CircleButton>
          )}
        </div>
      </header>

      {/* Hero photo — full-bleed square */}
      <div
        className={cn(
          'relative w-full aspect-square flex items-center justify-center overflow-hidden',
          photo?.isProcessed ? 'bg-checker' : 'bg-surface-2',
        )}
      >
        {url ? (
          <img
            src={url}
            alt={item.name}
            className={
              photo?.isProcessed
                ? 'max-h-full max-w-full object-contain'
                : 'w-full h-full object-cover'
            }
          />
        ) : (
          <div className="text-tertiary">No photo</div>
        )}

        {replacing && (
          <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-center px-6">
            <Loader2
              className="animate-spin text-accent mb-3"
              size={24}
              strokeWidth={2}
            />
            <div className="text-sm text-ink-50">
              {replacingProgress?.stage === 'loading-model'
                ? 'Downloading model'
                : 'Removing background'}
            </div>
          </div>
        )}

        {!editing && !replacing && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-3 right-3 p-2 rounded-full bg-surface-1/90 border border-hairline text-ink-50 backdrop-blur-sm active:scale-95 transition-transform"
            aria-label="Replace photo"
            title="Replace photo"
          >
            <ImagePlus size={16} strokeWidth={1.75} />
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

      {/* Info card — pulled up over the photo */}
      <div className="relative -mt-6 bg-surface-1 rounded-t-sheet border-t border-hairline px-5 pt-7 pb-8">
        {error && (
          <div className="mb-4 px-3 py-2 rounded-card bg-danger/10 border border-danger/30 text-danger text-sm">
            {error}
          </div>
        )}

        {item.archivedAt && (
          <div className="mb-4 px-3 py-2 rounded-card bg-surface-2 border border-hairline text-ink-300 text-xs">
            <div className="flex items-center gap-2">
              <Archive size={14} strokeWidth={1.75} />
              <span>
                Archived
                {item.archivedReason
                  ? ` · ${ARCHIVED_REASON_LABELS[item.archivedReason]}`
                  : ''}{' '}
                · {new Date(item.archivedAt).toLocaleDateString('en-IN')}
              </span>
            </div>
            {item.archivedNote && (
              <div className="mt-1 ml-6 text-tertiary">{item.archivedNote}</div>
            )}
          </div>
        )}

        {editing ? (
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
              seedWearCount: item.seedWearCount,
              seedAsOf: item.seedAsOf,
            }}
          />
        ) : (
          <>
            {/* Header — Fraunces name + inline stats */}
            <h1 className="font-display text-[22px] font-medium tracking-tight text-ink-50 leading-tight">
              {item.name}
            </h1>

            {(totalWearCount > 0 || cpw != null || lastRealWornAt) && (
              <div className="mt-2 flex items-center flex-wrap gap-x-2 gap-y-1 text-[13px] text-ink-300">
                {totalWearCount > 0 && (
                  <span className="tabular-nums">Worn {totalWearCount}×</span>
                )}
                {cpw != null && (
                  <>
                    <Dot />
                    <span className="tabular-nums">
                      ₹{Math.round(cpw).toLocaleString('en-IN')} / wear
                    </span>
                  </>
                )}
                {lastRealWornAt && (
                  <>
                    <Dot />
                    <span>Last worn {relativeDayLabel(lastRealWornAt)}</span>
                  </>
                )}
              </div>
            )}

            {photo?.isProcessed && (
              <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-tertiary">
                <Sparkles size={11} strokeWidth={2} className="text-accent" />
                Background removed on this device
              </div>
            )}

            {/* Wear-today CTA */}
            <button
              onClick={handleWearToday}
              disabled={busy || !!item.archivedAt}
              className={cn(
                'mt-5 w-full h-12 rounded-full font-medium flex items-center justify-center gap-2 transition-transform active:scale-[0.99] disabled:opacity-50',
                wornToday
                  ? 'bg-surface-2 border border-accent text-accent'
                  : 'bg-accent text-ink-950',
              )}
            >
              {wornToday ? (
                <>
                  <Check size={18} strokeWidth={2} />
                  Worn today
                </>
              ) : (
                <>
                  <CalendarPlus size={18} strokeWidth={1.75} />
                  I wore this today
                </>
              )}
            </button>

            {/* Backdate a wear */}
            <div className="mt-2">
              {!backdateOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setBackdateOpen(true)
                    setBackdateValue(new Date().toISOString().slice(0, 10))
                  }}
                  disabled={busy || !!item.archivedAt}
                  className="text-xs text-tertiary hover:text-ink-50 inline-flex items-center gap-1 disabled:opacity-50"
                >
                  <Plus size={12} strokeWidth={1.75} />
                  Log a past wear
                </button>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="date"
                    value={backdateValue}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setBackdateValue(e.target.value)}
                    className="form-input flex-1 py-1.5"
                  />
                  <button
                    type="button"
                    onClick={handleBackdateSubmit}
                    disabled={busy || !backdateValue}
                    className="px-3 py-1.5 rounded-full bg-accent text-ink-950 text-xs font-medium disabled:opacity-50"
                  >
                    Log it
                  </button>
                  <button
                    type="button"
                    onClick={() => setBackdateOpen(false)}
                    className="p-1.5 rounded-full text-tertiary hover:text-ink-50"
                    aria-label="Cancel"
                  >
                    <X size={14} strokeWidth={1.75} />
                  </button>
                </div>
              )}
            </div>

            {/* Metadata grid — only render when at least one field is present */}
            {(item.category ||
              item.color ||
              item.brand ||
              item.purchasePriceMinor != null ||
              item.purchasedAt ||
              item.seedAsOf) && (
              <div className="mt-6 grid grid-cols-2 gap-3">
                {item.category && (
                  <MetadataPill
                    icon={Tag}
                    label="Category"
                    value={item.category}
                  />
                )}
                {item.color && (
                  <MetadataPill
                    icon={Palette}
                    label="Color"
                    value={item.color}
                  />
                )}
                {item.brand && (
                  <MetadataPill
                    icon={Store}
                    label="Brand"
                    value={item.brand}
                  />
                )}
                {item.purchasePriceMinor != null && (
                  <MetadataPill
                    icon={IndianRupee}
                    label="Price"
                    value={`₹${(item.purchasePriceMinor / 100).toLocaleString(
                      'en-IN',
                    )}`}
                    tabular
                  />
                )}
                {item.purchasedAt && (
                  <MetadataPill
                    icon={Calendar}
                    label="Purchased"
                    value={new Date(item.purchasedAt).toLocaleDateString(
                      'en-IN',
                      { dateStyle: 'medium' },
                    )}
                    tabular
                  />
                )}
                {item.seedAsOf && !item.purchasedAt && (
                  <MetadataPill
                    icon={Calendar}
                    label="Owned since"
                    value={new Date(item.seedAsOf).toLocaleDateString('en-IN', {
                      dateStyle: 'medium',
                    })}
                    tabular
                  />
                )}
              </div>
            )}

            {/* Pre-owned baseline note */}
            {seedWearCount > 0 && (
              <div className="mt-4 px-3 py-2.5 rounded-card bg-surface-2 border border-hairline text-xs text-ink-300 flex items-center gap-2">
                <History size={14} strokeWidth={1.75} className="text-accent" />
                <span>
                  Pre-Hangr baseline:{' '}
                  <span className="text-ink-50 font-medium tabular-nums">
                    ~{seedWearCount} wears
                  </span>
                  {realWearCount > 0 && (
                    <>
                      {' '}
                      <span className="text-tertiary tabular-nums">
                        + {realWearCount} logged
                      </span>
                    </>
                  )}
                  . Edit to adjust.
                </span>
              </div>
            )}

            {/* Wear history */}
            {wears && wears.length > 0 && (
              <div className="mt-8">
                <h3 className="font-display italic text-[15px] text-ink-50 mb-2">
                  Wear history
                </h3>
                <ul className="divide-y divide-hairline">
                  {wears.slice(0, 20).map((w) => (
                    <li
                      key={w.id}
                      className="py-2.5 flex items-center justify-between text-sm"
                    >
                      <div>
                        <div className="text-ink-50">
                          {relativeDayLabel(w.wornAt)}
                          {w.source === 'backdated' && (
                            <span className="ml-2 text-[10px] text-tertiary uppercase tracking-wider">
                              backdated
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-tertiary tabular-nums">
                          {shortDate(w.wornAt)}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteWear(w.id)}
                        className="p-1.5 rounded-full text-tertiary hover:text-danger transition-colors"
                        aria-label="Remove wear"
                      >
                        <Trash2 size={14} strokeWidth={1.75} />
                      </button>
                    </li>
                  ))}
                </ul>
                {wears.length > 20 && (
                  <div className="mt-2 text-xs text-tertiary">
                    + {wears.length - 20} more
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <ArchiveDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={handleArchiveConfirm}
        itemName={item.name}
        busy={busy}
      />
    </div>
  )
}

function CircleButton({
  children,
  onClick,
  disabled,
  ariaLabel,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  ariaLabel: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="w-10 h-10 rounded-full bg-surface-1/90 border border-hairline backdrop-blur-sm text-ink-50 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
    >
      {children}
    </button>
  )
}

function Dot() {
  return <span className="text-hairline">•</span>
}
