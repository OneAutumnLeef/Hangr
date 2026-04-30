import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  value: ReactNode
  /** Tonal hue applied to the value. */
  tone?: 'default' | 'accent' | 'danger'
  /** Optional small prefix before the value (e.g. "₹"). Renders in tertiary. */
  prefix?: string
}

export function StatTile({ label, value, tone = 'default', prefix }: Props) {
  return (
    <div className="rounded-xl bg-surface-1 border border-hairline p-4 aspect-square flex flex-col justify-between">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-300">
        {label}
      </span>
      <span
        className={cn(
          'font-display text-[22px] font-medium tabular-nums leading-none truncate',
          tone === 'accent' && 'text-accent',
          tone === 'danger' && 'text-danger',
          tone === 'default' && 'text-ink-50',
        )}
      >
        {prefix && (
          <span className="text-tertiary mr-1 text-base">{prefix}</span>
        )}
        {value}
      </span>
    </div>
  )
}
