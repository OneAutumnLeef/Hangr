import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { listItems } from '@/db/items'
import { Sheet } from './Sheet'
import { MiniItemThumb } from './MiniItemThumb'
import { CategoryFilter } from './CategoryFilter'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (values: { name: string; itemIds: string[] }) => void
  /** When provided, the sheet is in "edit" mode. */
  initial?: { name: string; itemIds: string[] }
}

/**
 * Combined name input + multi-select item picker for creating or editing a
 * saved outfit. We don't reuse ItemPickerSheet here — the outfit flow needs a
 * name field above the grid, and merging that into the picker would muddy it.
 */
export function OutfitEditorSheet({
  open,
  onClose,
  onSave,
  initial,
}: Props) {
  const items = useLiveQuery(() => listItems())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [name, setName] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  // Reset when transitioning to open. Same pattern as ItemPickerSheet.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setSelected(new Set(initial?.itemIds ?? []))
      setName(initial?.name ?? '')
      setActiveCategory(null)
    }
  }

  const visibleItems = useMemo(() => {
    if (!items) return []
    if (activeCategory) {
      return items.filter((i) => i.category === activeCategory)
    }
    return items
  }, [items, activeCategory])

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

  const canSave = name.trim().length > 0 && selected.size > 0

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={initial ? 'Edit outfit' : 'New outfit'}
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-ink-400">
            {selected.size} item{selected.size !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-full text-sm text-ink-300"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                onSave({
                  name: name.trim(),
                  itemIds: Array.from(selected),
                })
              }
              disabled={!canSave}
              className="px-4 py-2 rounded-full bg-accent text-ink-950 text-sm font-medium disabled:opacity-40"
            >
              {initial ? 'Save changes' : 'Save outfit'}
            </button>
          </div>
        </div>
      }
    >
      <div className="px-4 py-3 space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Outfit name (e.g. Friday casual)"
          className="form-input"
          autoFocus
          maxLength={40}
        />

        {categories.length > 0 && (
          <CategoryFilter
            categories={categories}
            active={activeCategory}
            onChange={setActiveCategory}
          />
        )}

        {visibleItems.length === 0 ? (
          <div className="text-center text-sm text-ink-400 py-12">
            {items && items.length === 0
              ? 'Add some items to your closet first.'
              : 'No items match this category.'}
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
