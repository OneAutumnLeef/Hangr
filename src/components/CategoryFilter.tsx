import { cn } from '@/lib/utils'

interface Props {
  categories: string[]
  active: string | null
  onChange: (category: string | null) => void
  counts?: Record<string, number>
  totalCount?: number
}

export function CategoryFilter({
  categories,
  active,
  onChange,
  counts,
  totalCount,
}: Props) {
  if (categories.length === 0) return null

  return (
    <div className="-mx-5 px-5 overflow-x-auto scrollbar-none">
      <div className="flex items-center gap-2 pb-1">
        <Chip
          active={active === null}
          onClick={() => onChange(null)}
          count={totalCount}
        >
          All
        </Chip>
        {categories.map((c) => (
          <Chip
            key={c}
            active={active === c}
            onClick={() => onChange(c)}
            count={counts?.[c]}
          >
            {c}
          </Chip>
        ))}
      </div>
    </div>
  )
}

function Chip({
  children,
  active,
  onClick,
  count,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
  count?: number
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wider border transition-colors whitespace-nowrap',
        active
          ? 'bg-surface-2 text-accent border-hairline'
          : 'bg-surface-1 text-ink-300 border-hairline hover:text-ink-50',
      )}
    >
      {children}
      {count != null && (
        <span
          className={cn(
            'ml-1.5 tabular-nums',
            active ? 'text-accent/70' : 'text-tertiary',
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}
