import { useLiveQuery } from 'dexie-react-hooks'
import { Trash2, Pencil, CalendarPlus } from 'lucide-react'
import type { Outfit } from '@/db/dexie'
import { listItems } from '@/db/items'
import { Sheet } from './Sheet'
import { MiniItemThumb } from './MiniItemThumb'

interface Props {
  outfit: Outfit | null
  onClose: () => void
  onWearToday: () => void
  onEdit: () => void
  onDelete: () => void
  /** Disables the wear-today CTA — every item is already in today. */
  alreadyAllWorn?: boolean
}

/**
 * Detail view for a saved outfit. Shows member items, plus actions: log it for
 * today, edit, or delete. Items removed from the closet show as a "deleted
 * item" placeholder rather than disappearing silently — keeps the user oriented.
 */
export function OutfitDetailSheet({
  outfit,
  onClose,
  onWearToday,
  onEdit,
  onDelete,
  alreadyAllWorn,
}: Props) {
  const items = useLiveQuery(() => listItems({ includeArchived: true }))
  const itemMap = new Map(items?.map((i) => [i.id, i]) ?? [])
  const open = outfit !== null

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={outfit?.name ?? ''}
      footer={
        <div className="flex items-center gap-2">
          <button
            onClick={onDelete}
            className="p-2 -ml-1 rounded-full text-ink-400 hover:text-red-400"
            aria-label="Delete outfit"
          >
            <Trash2 size={18} />
          </button>
          <button
            onClick={onEdit}
            className="p-2 rounded-full text-ink-400 hover:text-ink-50"
            aria-label="Edit outfit"
          >
            <Pencil size={18} />
          </button>
          <button
            onClick={onWearToday}
            disabled={alreadyAllWorn}
            className="ml-auto px-4 py-2 rounded-full bg-accent text-ink-950 text-sm font-medium flex items-center gap-1.5 disabled:opacity-40"
          >
            <CalendarPlus size={14} />
            {alreadyAllWorn ? 'All in today' : 'Wear today'}
          </button>
        </div>
      }
    >
      <div className="px-4 py-3">
        {!outfit ? null : outfit.itemIds.length === 0 ? (
          <p className="text-sm text-ink-400 text-center py-6">
            This outfit has no items. Edit to add some.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {outfit.itemIds.map((id, idx) => {
              const item = itemMap.get(id)
              if (!item) {
                return (
                  <div
                    key={id + idx}
                    className="aspect-square rounded-xl bg-ink-800/40 border border-dashed border-ink-700 flex items-center justify-center text-[10px] text-ink-500 px-2 text-center"
                  >
                    deleted item
                  </div>
                )
              }
              return (
                <div
                  key={id + idx}
                  className="flex flex-col items-center gap-1.5"
                >
                  <MiniItemThumb item={item} size="md" />
                  <div className="text-[10px] text-ink-300 truncate max-w-full text-center">
                    {item.name}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Sheet>
  )
}
