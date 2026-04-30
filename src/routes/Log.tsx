import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Plus,
  X,
  CalendarCheck,
  ChevronDown,
  Pencil,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getItemPhoto, listItems } from '@/db/items'
import {
  deleteWear,
  listRecentWearDays,
  listWearsForDay,
  logSavedOutfit,
  logWear,
} from '@/db/wears'
import {
  archiveOutfit,
  createOutfit,
  listOutfits,
  updateOutfit,
} from '@/db/outfits'
import { listDayNotes, setDayNote } from '@/db/dayNotes'
import type { Item, Outfit } from '@/db/dexie'
import { addDays, startOfDay, relativeDayLabel, shortDate } from '@/lib/dates'
import { ItemPickerSheet } from '@/components/ItemPickerSheet'
import { OutfitChip } from '@/components/OutfitChip'
import { OutfitDetailSheet } from '@/components/OutfitDetailSheet'
import { OutfitEditorSheet } from '@/components/OutfitEditorSheet'
import { DayNoteSheet } from '@/components/DayNoteSheet'
import { EmptyState } from '@/components/EmptyState'
import { toast } from '@/lib/toast'

export function Log() {
  const today = startOfDay()
  const yesterdayMs = useMemo(() => addDays(today, -1), [today])
  const items = useLiveQuery(() => listItems({ includeArchived: true }))
  const todayWears = useLiveQuery(() => listWearsForDay(today), [today])
  const yesterdayWears = useLiveQuery(
    () => listWearsForDay(yesterdayMs),
    [yesterdayMs],
  )
  const recentDays = useLiveQuery(() => listRecentWearDays(30))
  const outfits = useLiveQuery(() => listOutfits())

  // All visible-day note bodies in one map: recent days + today + yesterday.
  // Re-runs whenever the day list changes, so editing flows back instantly.
  const visibleDays = useMemo(() => {
    const days = new Set<number>([today, yesterdayMs])
    if (recentDays) for (const d of recentDays) days.add(d.dayMs)
    return Array.from(days)
  }, [recentDays, today, yesterdayMs])
  const dayNotes = useLiveQuery(
    () => listDayNotes(visibleDays),
    [visibleDays],
  )

  const [pickerOpen, setPickerOpen] = useState(false)
  // Which date the picker logs to. Defaults to today; the yesterday-backfill
  // prompt swaps this to `yesterdayMs` before opening the picker.
  const [pickerDate, setPickerDate] = useState<number>(today)
  const [detailOutfit, setDetailOutfit] = useState<Outfit | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingOutfit, setEditingOutfit] = useState<Outfit | null>(null)
  // When set, opens the editor in CREATE mode but with these item ids
  // pre-selected. Used by the "save this combo?" auto-suggestion below.
  const [prefillItemIds, setPrefillItemIds] = useState<string[] | null>(null)
  // Recent-days inline expand. The chevron used to dangle as a visual hint
  // with no handler — tapping a row now reveals the day's items in a grid
  // and gives per-wear delete buttons.
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set())
  // Which day's note is being edited (null = sheet closed).
  const [editingNoteDay, setEditingNoteDay] = useState<number | null>(null)

  async function handleSaveDayNote(note: string) {
    if (editingNoteDay == null) return
    await setDayNote(editingNoteDay, note)
    setEditingNoteDay(null)
  }
  // Per-day dismissal of the "save today's combo?" suggestion. SessionStorage
  // so it doesn't persist forever — tomorrow it can suggest again.
  const dismissKey = `hangr.combo-dismissed.${today}`
  const [comboDismissed, setComboDismissed] = useState(() => {
    if (typeof sessionStorage === 'undefined') return false
    return sessionStorage.getItem(dismissKey) === '1'
  })
  // Same pattern for the yesterday-backfill prompt.
  const yesterdayDismissKey = `hangr.yesterday-dismissed.${today}`
  const [yesterdayDismissed, setYesterdayDismissed] = useState(() => {
    if (typeof sessionStorage === 'undefined') return false
    return sessionStorage.getItem(yesterdayDismissKey) === '1'
  })

  function toggleDay(dayMs: number) {
    setExpandedDays((prev) => {
      const next = new Set(prev)
      if (next.has(dayMs)) next.delete(dayMs)
      else next.add(dayMs)
      return next
    })
  }

  const itemMap = useMemo(() => {
    const m = new Map<string, NonNullable<typeof items>[number]>()
    if (items) for (const i of items) m.set(i.id, i)
    return m
  }, [items])

  const todayItemIds = useMemo(
    () => (todayWears ? todayWears.map((w) => w.itemId) : []),
    [todayWears],
  )

  // Whether today's items already match an existing saved outfit by exact
  // item-id set — if yes, no point suggesting "save this combo".
  const todayMatchesExistingOutfit = useMemo(() => {
    if (!outfits || todayItemIds.length === 0) return true
    const todaySet = new Set(todayItemIds)
    return outfits.some((o) => {
      if (o.itemIds.length !== todayItemIds.length) return false
      return o.itemIds.every((id) => todaySet.has(id))
    })
  }, [outfits, todayItemIds])

  // Surface the "save as outfit?" nudge once today crosses 3 logged items,
  // unless it duplicates an existing saved outfit or the user dismissed it.
  const showComboSuggestion =
    !comboDismissed &&
    todayWears !== undefined &&
    todayWears.length >= 3 &&
    !todayMatchesExistingOutfit

  function dismissCombo() {
    setComboDismissed(true)
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(dismissKey, '1')
    }
  }

  function suggestSaveCombo() {
    setEditingOutfit(null)
    setPrefillItemIds(todayItemIds)
    setEditorOpen(true)
  }

  async function handleAddItems(ids: string[]) {
    setPickerOpen(false)
    const targetDate = pickerDate
    setPickerDate(today) // reset for next open
    if (ids.length === 0) return
    // Skip ids already worn that day (avoid duplicates)
    const existing = await listWearsForDay(targetDate)
    const already = new Set(existing.map((w) => w.itemId))
    const toAdd = ids.filter((id) => !already.has(id))
    for (const id of toAdd) {
      // eslint-disable-next-line no-await-in-loop
      await logWear({
        itemId: id,
        wornAt: targetDate,
        source: targetDate === today ? 'manual' : 'backdated',
      })
    }
    if (targetDate !== today && toAdd.length > 0) {
      toast.success(
        `Logged ${toAdd.length} item${toAdd.length === 1 ? '' : 's'} for yesterday`,
      )
    }
  }

  function dismissYesterday() {
    setYesterdayDismissed(true)
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(yesterdayDismissKey, '1')
    }
  }

  function openYesterdayPicker() {
    setPickerDate(yesterdayMs)
    setPickerOpen(true)
  }

  // Show the backfill nudge once per session per day, but only if there are
  // actually items in the closet and yesterday came up empty.
  const showYesterdayPrompt =
    !yesterdayDismissed &&
    yesterdayWears !== undefined &&
    yesterdayWears.length === 0

  async function removeWear(wearId: string) {
    await deleteWear(wearId)
  }

  async function handleWearOutfit(outfit: Outfit) {
    const already = new Set(todayItemIds)
    const toAdd = outfit.itemIds.filter((id) => !already.has(id))
    if (toAdd.length === 0) {
      toast.info('Already in today')
      setDetailOutfit(null)
      return
    }
    await logSavedOutfit({ id: outfit.id, itemIds: toAdd }, today)
    setDetailOutfit(null)
    toast.success(`Logged "${outfit.name}"`)
  }

  async function handleSaveOutfit(values: {
    name: string
    itemIds: string[]
  }) {
    if (editingOutfit) {
      await updateOutfit(editingOutfit.id, values)
      toast.success('Outfit updated')
    } else {
      await createOutfit(values)
      toast.success('Outfit saved')
    }
    setEditorOpen(false)
    setEditingOutfit(null)
  }

  async function handleDeleteOutfit(outfit: Outfit) {
    await archiveOutfit(outfit.id)
    setDetailOutfit(null)
    toast.success('Outfit removed')
  }

  function openNewOutfit() {
    setEditingOutfit(null)
    setEditorOpen(true)
  }

  function openEditOutfit(outfit: Outfit) {
    setDetailOutfit(null)
    setEditingOutfit(outfit)
    setEditorOpen(true)
  }

  // Whether every member of the active detail outfit is already worn today —
  // disables the "Wear today" CTA.
  const detailAllWorn = useMemo(() => {
    if (!detailOutfit) return false
    if (detailOutfit.itemIds.length === 0) return true
    const set = new Set(todayItemIds)
    return detailOutfit.itemIds.every((id) => set.has(id))
  }, [detailOutfit, todayItemIds])

  if (items === undefined || todayWears === undefined) {
    return (
      <div className="px-5 pt-12 max-w-md mx-auto">
        <div className="h-8 w-32 rounded-md bg-surface-2 animate-pulse" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="px-5 pt-12 max-w-md mx-auto">
        <h1 className="font-display text-[28px] font-semibold tracking-tight text-ink-50 leading-tight mb-6">
          Log
        </h1>
        <EmptyState
          icon={<CalendarCheck size={48} strokeWidth={1.5} />}
          title="No items to log"
          message="Add a few items to your closet first, then come back to start logging what you wear."
        />
      </div>
    )
  }

  return (
    <div className="px-5 pt-12 pb-4 max-w-md mx-auto">
      <header className="mb-7">
        <h1 className="font-display text-[28px] font-semibold tracking-tight text-ink-50 leading-tight">
          Log
        </h1>
        <p className="mt-1 text-[13px] text-ink-300 tabular-nums">
          Today · {shortDate(today)}
        </p>
      </header>

      {/* Yesterday backfill prompt — friction killer for missed days */}
      {showYesterdayPrompt && (
        <div className="mb-6 rounded-card bg-surface-1 border border-hairline px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[13px] text-ink-50">
              Did you wear anything yesterday?
            </div>
            <div className="text-[11px] text-tertiary mt-0.5 leading-snug">
              {relativeDayLabel(yesterdayMs)} · {shortDate(yesterdayMs)} —
              backfill in seconds.
            </div>
          </div>
          <button
            type="button"
            onClick={dismissYesterday}
            className="text-[11px] uppercase tracking-wider text-tertiary px-2 py-1 hover:text-ink-50 transition-colors"
          >
            No
          </button>
          <button
            type="button"
            onClick={openYesterdayPicker}
            className="px-3 py-1.5 rounded-full bg-accent text-ink-950 text-[11px] font-semibold uppercase tracking-wider active:scale-95 transition-transform"
          >
            Log
          </button>
        </div>
      )}

      {/* Today's outfit — hero card */}
      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display text-[20px] font-medium text-ink-50">
            Today's outfit
          </h2>
          <button
            onClick={() => setPickerOpen(true)}
            className="px-3 py-1.5 rounded-full bg-accent text-ink-950 text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1 active:scale-95 transition-transform"
          >
            <Plus size={12} strokeWidth={2} />
            Add
          </button>
        </div>

        {todayWears.length === 0 ? (
          <button
            onClick={() => setPickerOpen(true)}
            className="w-full rounded-card bg-surface-1 border border-dashed border-hairline px-4 py-10 text-center text-tertiary hover:text-accent hover:border-accent/50 transition-colors"
          >
            <div className="text-sm">Nothing logged yet today.</div>
            <div className="mt-2 text-xs text-accent">
              Log what you're wearing →
            </div>
          </button>
        ) : (
          <div className="rounded-card bg-surface-1 border border-hairline p-3 overflow-hidden">
            <div className="grid grid-cols-3 gap-2">
              {todayWears.map((w) => {
                const item = itemMap.get(w.itemId)
                if (!item) return null
                return (
                  <TodayItemTile
                    key={w.id}
                    item={item}
                    onRemove={() => removeWear(w.id)}
                  />
                )
              })}
            </div>
            <div className="mt-3 flex items-baseline justify-between px-1">
              <div className="text-[13px] text-ink-300 tabular-nums">
                {todayWears.length}{' '}
                {todayWears.length === 1 ? 'item logged' : 'items logged'}
              </div>
            </div>

            {/* Today's diary note — shown if present, always editable */}
            <DayNoteRow
              dayMs={today}
              note={dayNotes?.get(today)}
              onEdit={() => setEditingNoteDay(today)}
            />

            {showComboSuggestion && (
              <div className="mt-3 -mx-3 -mb-3 px-3 py-3 border-t border-hairline bg-surface-2/30 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-ink-50">
                    Save as a saved outfit?
                  </div>
                  <div className="text-[11px] text-tertiary leading-snug mt-0.5">
                    One-tap log next time you wear this combo.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={dismissCombo}
                  className="text-[11px] uppercase tracking-wider text-tertiary px-2 py-1 hover:text-ink-50 transition-colors"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={suggestSaveCombo}
                  className="px-3 py-1.5 rounded-full bg-accent text-ink-950 text-[11px] font-semibold uppercase tracking-wider active:scale-95 transition-transform"
                >
                  Save
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Saved outfits — quick-log rail */}
      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display text-[20px] font-medium text-ink-50">
            Saved outfits
          </h2>
          {outfits && outfits.length > 0 && (
            <button
              onClick={openNewOutfit}
              className="text-[11px] font-semibold uppercase tracking-wider text-accent"
            >
              + New
            </button>
          )}
        </div>
        {outfits === undefined ? (
          <div className="h-40 rounded-card bg-surface-1 animate-pulse" />
        ) : outfits.length === 0 ? (
          <button
            onClick={openNewOutfit}
            className="w-full px-4 py-4 rounded-card border border-dashed border-hairline text-tertiary hover:text-accent hover:border-accent/50 flex items-center justify-center gap-2 transition-colors"
          >
            <Plus size={16} strokeWidth={1.75} />
            <span className="text-sm">
              Save outfits for one-tap logging
            </span>
          </button>
        ) : (
          <div className="flex items-stretch gap-4 overflow-x-auto scrollbar-none -mx-5 px-5 pb-1 snap-x">
            {outfits.map((o) => (
              <OutfitChip
                key={o.id}
                outfit={o}
                onClick={() => setDetailOutfit(o)}
              />
            ))}
            <button
              onClick={openNewOutfit}
              className="snap-start shrink-0 w-40 flex flex-col items-stretch gap-2 group text-left"
            >
              <div className="aspect-square rounded-card bg-surface-1 border border-dashed border-hairline text-tertiary group-hover:text-accent group-hover:border-accent/50 flex flex-col items-center justify-center gap-2 transition-colors">
                <Plus size={24} strokeWidth={1.75} />
                <span className="text-[11px] uppercase tracking-wider font-semibold">
                  New outfit
                </span>
              </div>
              <div className="text-[13px] text-tertiary">Create new</div>
            </button>
          </div>
        )}
      </section>

      {/* Recent days */}
      <section>
        <h2 className="font-display text-[20px] font-medium text-ink-50 mb-3">
          Recent days
        </h2>
        {recentDays === undefined ? (
          <div className="h-16 rounded-card bg-surface-1 animate-pulse" />
        ) : recentDays.filter((d) => d.dayMs !== today).length === 0 ? (
          <p className="text-sm text-tertiary">
            Days you log will show up here.
          </p>
        ) : (
          <ul className="space-y-2">
            {recentDays
              .filter((d) => d.dayMs !== today)
              .map((day) => {
                const expanded = expandedDays.has(day.dayMs)
                return (
                  <li
                    key={day.dayMs}
                    className="bg-surface-1 border border-hairline rounded-card overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleDay(day.dayMs)}
                      aria-expanded={expanded}
                      className="w-full flex items-center gap-4 p-3 text-left hover:bg-surface-2 transition-colors"
                    >
                      <div className="flex -space-x-2 shrink-0">
                        {day.itemIds.slice(0, 4).map((id, idx) => {
                          const item = itemMap.get(id)
                          if (!item) return null
                          return (
                            <CircleThumb
                              key={id + idx}
                              item={item}
                              zIndex={4 - idx}
                            />
                          )
                        })}
                        {day.itemIds.length > 4 && (
                          <div className="relative h-10 w-10 rounded-full bg-surface-2 border border-hairline flex items-center justify-center text-[10px] font-medium tabular-nums text-ink-300">
                            +{day.itemIds.length - 4}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-medium text-ink-50">
                          {relativeDayLabel(day.dayMs)}
                        </div>
                        <div className="text-[12px] text-tertiary tabular-nums">
                          {shortDate(day.dayMs)} · {day.itemIds.length}{' '}
                          {day.itemIds.length === 1 ? 'item' : 'items'}
                        </div>
                      </div>
                      <ChevronDown
                        size={16}
                        strokeWidth={1.75}
                        className={cn(
                          'text-tertiary shrink-0 transition-transform duration-200',
                          expanded && 'rotate-180',
                        )}
                      />
                    </button>

                    {expanded && (
                      <div className="border-t border-hairline p-3 space-y-3">
                        {day.itemIds.length === 0 ? (
                          <div className="text-[12px] text-tertiary text-center py-3">
                            No items logged for this day.
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-2">
                            {day.itemIds.map((id, idx) => {
                              const item = itemMap.get(id)
                              const wearId = day.wearIds[idx]
                              if (!item || !wearId) return null
                              return (
                                <TodayItemTile
                                  key={wearId}
                                  item={item}
                                  onRemove={() => removeWear(wearId)}
                                />
                              )
                            })}
                          </div>
                        )}
                        <DayNoteRow
                          dayMs={day.dayMs}
                          note={dayNotes?.get(day.dayMs)}
                          onEdit={() => setEditingNoteDay(day.dayMs)}
                        />
                      </div>
                    )}
                  </li>
                )
              })}
          </ul>
        )}
      </section>

      <ItemPickerSheet
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false)
          setPickerDate(today)
        }}
        onConfirm={handleAddItems}
        title={
          pickerDate === today
            ? "Log today's outfit"
            : "Log yesterday's outfit"
        }
        excludeIds={
          pickerDate === today
            ? todayItemIds
            : (yesterdayWears?.map((w) => w.itemId) ?? [])
        }
        confirmLabel={
          pickerDate === today ? 'Add to today' : 'Add to yesterday'
        }
      />

      <OutfitDetailSheet
        outfit={detailOutfit}
        onClose={() => setDetailOutfit(null)}
        onWearToday={() =>
          detailOutfit && handleWearOutfit(detailOutfit)
        }
        onEdit={() => detailOutfit && openEditOutfit(detailOutfit)}
        onDelete={() => detailOutfit && handleDeleteOutfit(detailOutfit)}
        alreadyAllWorn={detailAllWorn}
      />

      <OutfitEditorSheet
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false)
          setEditingOutfit(null)
          setPrefillItemIds(null)
        }}
        onSave={handleSaveOutfit}
        initial={
          editingOutfit
            ? {
                name: editingOutfit.name,
                itemIds: editingOutfit.itemIds,
              }
            : prefillItemIds
              ? { name: '', itemIds: prefillItemIds }
              : undefined
        }
      />

      <DayNoteSheet
        dayMs={editingNoteDay}
        initialNote={
          editingNoteDay != null ? dayNotes?.get(editingNoteDay) : undefined
        }
        onClose={() => setEditingNoteDay(null)}
        onSave={handleSaveDayNote}
      />
    </div>
  )
}

/**
 * One-line diary note display + edit affordance for a given day. When there's
 * no note yet, renders as a quiet "+ note" link in tertiary; when there is,
 * the note becomes the body and the pencil sits to the right.
 */
function DayNoteRow({
  dayMs: _dayMs,
  note,
  onEdit,
}: {
  dayMs: number
  note?: string
  onEdit: () => void
}) {
  if (note) {
    return (
      <button
        type="button"
        onClick={onEdit}
        className="w-full flex items-start gap-2 text-left rounded-card bg-surface-2/40 border border-hairline px-3 py-2 hover:bg-surface-2 transition-colors"
      >
        <span className="flex-1 min-w-0 text-[12px] text-ink-100 leading-relaxed italic font-display">
          “{note}”
        </span>
        <Pencil
          size={12}
          strokeWidth={1.75}
          className="text-tertiary mt-0.5 shrink-0"
        />
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onEdit}
      className="text-[11px] uppercase tracking-wider text-tertiary hover:text-accent transition-colors flex items-center gap-1.5"
    >
      <Pencil size={11} strokeWidth={1.75} />
      Add a note
    </button>
  )
}

/** Tile in Today's outfit grid — fills the cell, with a corner-X to remove. */
function TodayItemTile({
  item,
  onRemove,
}: {
  item: Item
  onRemove: () => void
}) {
  const photo = useLiveQuery(
    () =>
      item.primaryPhotoId
        ? getItemPhoto(item.primaryPhotoId)
        : Promise.resolve(undefined),
    [item.primaryPhotoId],
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

  return (
    <div className="relative aspect-square rounded-lg overflow-hidden bg-surface-2 border border-hairline">
      <Link to={`/closet/${item.id}`} className="block w-full h-full">
        {url ? (
          <img
            src={url}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-tertiary text-[10px] px-1 text-center">
            {item.name.slice(0, 2)}
          </div>
        )}
      </Link>
      <button
        onClick={onRemove}
        className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-ink-950/80 backdrop-blur-sm border border-hairline text-ink-300 hover:text-danger flex items-center justify-center transition-colors"
        aria-label={`Remove ${item.name}`}
      >
        <X size={12} strokeWidth={2} />
      </button>
    </div>
  )
}

/** Circular thumb used in Recent Days stacks. */
function CircleThumb({ item, zIndex }: { item: Item; zIndex: number }) {
  const photo = useLiveQuery(
    () =>
      item.primaryPhotoId
        ? getItemPhoto(item.primaryPhotoId)
        : Promise.resolve(undefined),
    [item.primaryPhotoId],
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

  return (
    <div
      className="relative h-10 w-10 rounded-full bg-surface-2 border border-hairline overflow-hidden flex items-center justify-center"
      style={{ zIndex }}
      title={item.name}
    >
      {url ? (
        <img
          src={url}
          alt=""
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-tertiary text-[9px] text-center">
          {item.name.slice(0, 2)}
        </span>
      )}
    </div>
  )
}
