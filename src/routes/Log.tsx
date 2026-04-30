import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2, CalendarCheck, ChevronRight, Bookmark } from 'lucide-react'
import { listItems } from '@/db/items'
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
import type { Outfit } from '@/db/dexie'
import { startOfDay, relativeDayLabel, shortDate } from '@/lib/dates'
import { MiniItemThumb } from '@/components/MiniItemThumb'
import { ItemPickerSheet } from '@/components/ItemPickerSheet'
import { OutfitChip } from '@/components/OutfitChip'
import { OutfitDetailSheet } from '@/components/OutfitDetailSheet'
import { OutfitEditorSheet } from '@/components/OutfitEditorSheet'
import { EmptyState } from '@/components/EmptyState'
import { toast } from '@/lib/toast'

export function Log() {
  const today = startOfDay()
  const items = useLiveQuery(() => listItems({ includeArchived: true }))
  const todayWears = useLiveQuery(() => listWearsForDay(today), [today])
  const recentDays = useLiveQuery(() => listRecentWearDays(30))
  const outfits = useLiveQuery(() => listOutfits())

  const [pickerOpen, setPickerOpen] = useState(false)
  const [detailOutfit, setDetailOutfit] = useState<Outfit | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingOutfit, setEditingOutfit] = useState<Outfit | null>(null)

  const itemMap = useMemo(() => {
    const m = new Map<string, NonNullable<typeof items>[number]>()
    if (items) for (const i of items) m.set(i.id, i)
    return m
  }, [items])

  const todayItemIds = useMemo(
    () => (todayWears ? todayWears.map((w) => w.itemId) : []),
    [todayWears],
  )

  async function handleAddItems(ids: string[]) {
    setPickerOpen(false)
    if (ids.length === 0) return
    // Skip ids already worn today (avoid duplicates)
    const already = new Set(todayItemIds)
    const toAdd = ids.filter((id) => !already.has(id))
    for (const id of toAdd) {
      // eslint-disable-next-line no-await-in-loop
      await logWear({ itemId: id, wornAt: today })
    }
  }

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
      <div className="px-4 pt-12 max-w-md mx-auto">
        <div className="h-8 w-32 rounded-md bg-ink-800 animate-pulse" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="px-4 pt-16 max-w-md mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Log</h1>
        <EmptyState
          icon={<CalendarCheck size={48} />}
          title="No items to log"
          message="Add a few items to your closet first, then come back to start logging what you wear."
        />
      </div>
    )
  }

  return (
    <div className="px-4 pt-12 pb-4 max-w-md mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Log</h1>
        <p className="text-sm text-ink-400">
          What you wore, day by day
        </p>
      </header>

      {/* Saved outfits — quick-log rail above today */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Bookmark size={14} className="text-ink-400" />
            <span className="text-sm font-medium text-ink-100">
              Saved outfits
            </span>
          </div>
          {outfits && outfits.length > 0 && (
            <button
              onClick={openNewOutfit}
              className="text-xs text-accent"
            >
              + New
            </button>
          )}
        </div>
        {outfits === undefined ? (
          <div className="h-32 rounded-xl bg-ink-800 animate-pulse" />
        ) : outfits.length === 0 ? (
          <button
            onClick={openNewOutfit}
            className="w-full px-4 py-3 rounded-2xl border-2 border-dashed border-ink-700 text-ink-400 hover:text-accent hover:border-accent flex items-center justify-center gap-2 transition"
          >
            <Plus size={16} />
            <span className="text-sm">
              Save outfits for one-tap logging
            </span>
          </button>
        ) : (
          <div className="flex items-stretch gap-3 overflow-x-auto -mx-4 px-4 pb-1">
            {outfits.map((o) => (
              <OutfitChip
                key={o.id}
                outfit={o}
                onClick={() => setDetailOutfit(o)}
              />
            ))}
            <button
              onClick={openNewOutfit}
              className="shrink-0 w-28 aspect-square rounded-xl border-2 border-dashed border-ink-700 text-ink-400 hover:text-accent hover:border-accent flex flex-col items-center justify-center gap-1 transition"
            >
              <Plus size={20} />
              <span className="text-[10px]">New outfit</span>
            </button>
          </div>
        )}
      </section>

      {/* Today's outfit */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-medium text-ink-100">Today</div>
            <div className="text-xs text-ink-500">{relativeDayLabel(today)}</div>
          </div>
          <button
            onClick={() => setPickerOpen(true)}
            className="px-3 py-1.5 rounded-full bg-accent text-ink-950 text-xs font-medium flex items-center gap-1 active:scale-95 transition"
          >
            <Plus size={14} />
            Add items
          </button>
        </div>

        {todayWears.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-900/50 px-4 py-6 text-center">
            <p className="text-sm text-ink-400">
              Nothing logged yet today.
            </p>
            <button
              onClick={() => setPickerOpen(true)}
              className="mt-3 text-sm text-accent font-medium"
            >
              Log what you're wearing
            </button>
          </div>
        ) : (
          <div className="flex items-stretch gap-3 overflow-x-auto -mx-4 px-4 pb-1">
            {todayWears.map((w) => {
              const item = itemMap.get(w.itemId)
              if (!item) return null
              return (
                <div
                  key={w.id}
                  className="shrink-0 flex flex-col items-center gap-1 w-20"
                >
                  <div className="relative">
                    <Link to={`/closet/${item.id}`}>
                      <MiniItemThumb item={item} size="md" />
                    </Link>
                    <button
                      onClick={() => removeWear(w.id)}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-ink-900 border border-ink-700 text-ink-300 hover:text-red-400 flex items-center justify-center"
                      aria-label="Remove"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="text-[10px] text-ink-300 truncate max-w-full">
                    {item.name}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Recent days */}
      <section>
        <h2 className="text-sm font-medium text-ink-100 mb-3">Recent days</h2>
        {recentDays === undefined ? (
          <div className="h-16 rounded-xl bg-ink-800 animate-pulse" />
        ) : recentDays.filter((d) => d.dayMs !== today).length === 0 ? (
          <p className="text-sm text-ink-500">
            Days you log will show up here.
          </p>
        ) : (
          <ul className="divide-y divide-ink-800">
            {recentDays
              .filter((d) => d.dayMs !== today)
              .map((day) => (
                <li
                  key={day.dayMs}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-ink-100">
                      {relativeDayLabel(day.dayMs)}
                    </div>
                    <div className="text-xs text-ink-500">
                      {shortDate(day.dayMs)} ·{' '}
                      {day.itemIds.length}{' '}
                      {day.itemIds.length === 1 ? 'item' : 'items'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {day.itemIds.slice(0, 4).map((id, idx) => {
                      const item = itemMap.get(id)
                      if (!item) return null
                      return (
                        <MiniItemThumb
                          key={id + idx}
                          item={item}
                          size="sm"
                        />
                      )
                    })}
                    {day.itemIds.length > 4 && (
                      <div className="text-xs text-ink-500 ml-1">
                        +{day.itemIds.length - 4}
                      </div>
                    )}
                  </div>
                  <ChevronRight
                    size={16}
                    className="text-ink-600 shrink-0"
                  />
                </li>
              ))}
          </ul>
        )}
      </section>

      <ItemPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={handleAddItems}
        title="Log today's outfit"
        excludeIds={todayItemIds}
        confirmLabel="Add to today"
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
        }}
        onSave={handleSaveOutfit}
        initial={
          editingOutfit
            ? {
                name: editingOutfit.name,
                itemIds: editingOutfit.itemIds,
              }
            : undefined
        }
      />
    </div>
  )
}
