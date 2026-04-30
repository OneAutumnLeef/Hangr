import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ShoppingBag } from 'lucide-react'
import { listItems } from '@/db/items'
import { getWearStatsByItem } from '@/db/wears'
import { listWants } from '@/db/wants'
import { ItemCard } from '@/components/ItemCard'
import { EmptyState } from '@/components/EmptyState'
import { HangerIcon } from '@/components/HangerIcon'
import { CategoryFilter } from '@/components/CategoryFilter'

export function Closet() {
  const navigate = useNavigate()
  const items = useLiveQuery(() => listItems())
  const wearStats = useLiveQuery(() => getWearStatsByItem())
  const wantsCount = useLiveQuery(async () => (await listWants()).length)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const { categories, counts } = useMemo(() => {
    const counts: Record<string, number> = {}
    if (!items) return { categories: [] as string[], counts }
    for (const i of items) {
      if (i.category) counts[i.category] = (counts[i.category] ?? 0) + 1
    }
    return { categories: Object.keys(counts).sort(), counts }
  }, [items])

  const visibleItems = useMemo(() => {
    if (!items) return []
    if (!activeCategory) return items
    return items.filter((i) => i.category === activeCategory)
  }, [items, activeCategory])

  const wearCountFor = (itemId: string, seed = 0) =>
    (wearStats?.get(itemId)?.count ?? 0) + seed

  if (items === undefined) {
    return (
      <div className="px-5 pt-12 max-w-md mx-auto">
        <div className="h-8 w-32 rounded-md bg-surface-2 animate-pulse" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="px-5 pt-16 max-w-md mx-auto">
        <EmptyState
          icon={<HangerIcon className="h-12 w-12" />}
          title="Your closet is empty"
          message="Photograph your first piece to start tracking what you actually wear."
          actionLabel="Add your first piece"
          onAction={() => navigate('/capture')}
        />
      </div>
    )
  }

  return (
    <div className="px-5 pt-12 pb-4 max-w-md mx-auto">
      <header className="mb-5 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-ink-50 leading-tight">
            Closet
          </h1>
          <p className="mt-1 text-[13px] text-ink-300 tabular-nums">
            {visibleItems.length}
            {activeCategory ? ` ${activeCategory.toLowerCase()}` : ''}{' '}
            {visibleItems.length === 1 ? 'item' : 'items'}
            {activeCategory && (
              <span className="text-tertiary"> of {items.length}</span>
            )}
          </p>
        </div>
        <Link
          to="/wants"
          aria-label="Want list"
          className="shrink-0 mt-1 px-3 h-9 rounded-full border border-hairline bg-surface-1 text-ink-200 text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 hover:text-accent hover:border-accent/50 transition-colors"
        >
          <ShoppingBag size={12} strokeWidth={1.75} />
          Want
          {wantsCount != null && wantsCount > 0 && (
            <span className="tabular-nums text-accent ml-0.5">
              {wantsCount}
            </span>
          )}
        </Link>
      </header>

      {categories.length > 0 && (
        <div className="mb-5">
          <CategoryFilter
            categories={categories}
            active={activeCategory}
            onChange={setActiveCategory}
            counts={counts}
            totalCount={items.length}
          />
        </div>
      )}

      {visibleItems.length === 0 ? (
        <div className="py-12 text-center text-ink-300 text-sm">
          No {activeCategory?.toLowerCase()} items yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {visibleItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              wearCount={wearCountFor(item.id, item.seedWearCount ?? 0)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
