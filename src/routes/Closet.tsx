import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus } from 'lucide-react'
import { listItems } from '@/db/items'
import { ItemCard } from '@/components/ItemCard'
import { EmptyState } from '@/components/EmptyState'
import { HangerIcon } from '@/components/HangerIcon'
import { CategoryFilter } from '@/components/CategoryFilter'

export function Closet() {
  const navigate = useNavigate()
  const items = useLiveQuery(() => listItems())
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const categories = useMemo(() => {
    if (!items) return []
    const seen = new Set<string>()
    items.forEach((i) => {
      if (i.category) seen.add(i.category)
    })
    return Array.from(seen).sort()
  }, [items])

  const visibleItems = useMemo(() => {
    if (!items) return []
    if (!activeCategory) return items
    return items.filter((i) => i.category === activeCategory)
  }, [items, activeCategory])

  if (items === undefined) {
    return (
      <div className="px-4 pt-12 max-w-md mx-auto">
        <div className="h-8 w-32 rounded-md bg-ink-800 animate-pulse" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="px-4 pt-16 max-w-md mx-auto">
        <EmptyState
          icon={<HangerIcon className="h-12 w-12" />}
          title="Your closet is empty"
          message="Add your first item to start tracking what you actually wear."
          actionLabel="Add an item"
          onAction={() => navigate('/capture')}
        />
      </div>
    )
  }

  return (
    <div className="px-4 pt-12 pb-4 max-w-md mx-auto">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Closet</h1>
          <p className="text-sm text-ink-400">
            {visibleItems.length}
            {activeCategory ? ` ${activeCategory.toLowerCase()}` : ''}{' '}
            {visibleItems.length === 1 ? 'item' : 'items'}
            {activeCategory && (
              <>
                {' '}
                <span className="text-ink-500">of {items.length}</span>
              </>
            )}
          </p>
        </div>
        <button
          onClick={() => navigate('/capture')}
          className="p-2.5 rounded-full bg-accent text-ink-950 active:scale-95 transition"
          aria-label="Add item"
        >
          <Plus size={20} />
        </button>
      </header>

      {categories.length > 0 && (
        <div className="mb-4">
          <CategoryFilter
            categories={categories}
            active={activeCategory}
            onChange={setActiveCategory}
          />
        </div>
      )}

      {visibleItems.length === 0 ? (
        <div className="py-12 text-center text-ink-400 text-sm">
          No {activeCategory?.toLowerCase()} items yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {visibleItems.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
