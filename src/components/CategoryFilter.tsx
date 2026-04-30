import { cn } from '@/lib/utils'

interface Props {
  categories: string[]
  active: string | null
  onChange: (category: string | null) => void
}

export function CategoryFilter({ categories, active, onChange }: Props) {
  if (categories.length === 0) return null

  return (
    <div className="-mx-4 px-4 overflow-x-auto scrollbar-none">
      <div className="flex items-center gap-2 pb-1">
        <Chip active={active === null} onClick={() => onChange(null)}>
          All
        </Chip>
        {categories.map((c) => (
          <Chip key={c} active={active === c} onClick={() => onChange(c)}>
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
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition border',
        active
          ? 'bg-accent text-ink-950 border-accent'
          : 'bg-ink-800 text-ink-300 border-ink-700 hover:text-ink-50',
      )}
    >
      {children}
    </button>
  )
}
