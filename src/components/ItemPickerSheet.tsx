import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { listItems } from '@/db/items'
import { Sheet } from './Sheet'
import { MiniItemThumb } from './MiniItemThumb'
import { CategoryFilter } from './CategoryFilter'

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: (itemIds: string[]) => void
  title?: string
  /** Pre-selected item ids when opening. */
  initialSelected?: string[]
  /** Item ids to hide from the picker entirely. */
  excludeIds?: string[]
  confirmLabel?: string
}

/** Multi-select picker over the current closet, in a bottom sheet. */
export function ItemPickerSheet({
  open,
  onClose,
  onConfirm,
  title = 'Pick items',
  initialSelected = [],
  excludeIds,
  confirmLabel = 'Confirm',
}: Props) {
  const items = useLiveQuery(() => listItems())
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelected),
  )
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  // Reset selection whenever the sheet transitions to open.
  // Pattern: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setSelected(new Set(initialSelected))
      setActiveCategory(null)
    }
  }

  const visibleItems = useMemo(() => {
    if (!items) return []
    let arr = items
    if (excludeIds && excludeIds.length) {
      const exc = new Set(excludeIds)
      arr = arr.filter((i) => !exc.has(i.id))
    }
    if (activeCategory) {
      arr = arr.filter((i) => i.category === activeCategory)
    }
    return arr
  }, [items, excludeIds, activeCategory])

  const categories = useMemo(() => {
    if (!items) return []
    const seen = new Set<string>()
    items.forEach((i) => i.category && seen.add(i.category))
    return Array.from(seen).sort()
  }, [items])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-ink-400">
            {selected.size} selected
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-full text-sm text-ink-300"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirm(Array.from(selected))
              }}
              disabled={selected.size === 0}
              className="px-4 py-2 rounded-full bg-accent text-ink-950 text-sm font-medium disabled:opacity-40"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      }
    >
      <div className="px-4 py-3">
        {categories.length > 0 && (
          <div className="mb-3">
            <CategoryFilter
              categories={categories}
              active={activeCategory}
              onChange={setActiveCategory}
            />
          </div>
        )}

        {visibleItems.length === 0 ? (
          <div className="text-center text-sm text-ink-400 py-12">
            {items && items.length === 0
              ? 'Add some items first.'
              : 'No items match.'}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {visibleItems.map((item) => (
              <button
                key={item.id}
                onClick={() => toggle(item.id)}
                className="flex flex-col items-center gap-1 group"
              >
                <MiniItemThumb
                  item={item}
                  size="md"
                  selected={selected.has(item.id)}
                />
                <div className="text-[10px] text-ink-300 truncate max-w-full px-1">
                  {item.name}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  )
}
