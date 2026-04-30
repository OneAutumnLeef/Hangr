import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  value: ReactNode
  hint?: string
  accent?: boolean
}

export function StatTile({ label, value, hint, accent }: Props) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-4',
        accent
          ? 'bg-accent/10 border-accent/30'
          : 'bg-ink-800 border-ink-800',
      )}
    >
      <div className="text-xs uppercase tracking-wide text-ink-400">
        {label}
      </div>
      <div
        className={cn(
          'mt-1 text-2xl font-semibold tabular-nums',
          accent && 'text-accent',
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-ink-500">{hint}</div>}
    </div>
  )
}
