import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  icon: LucideIcon
  label: string
  value: string
  /** Use tabular-nums on the value (dates, prices, counts). */
  tabular?: boolean
}

export function MetadataPill({ icon: Icon, label, value, tabular }: Props) {
  return (
    <div className="bg-surface-2 border border-hairline rounded-lg p-2.5 flex items-center gap-3">
      <Icon
        size={18}
        strokeWidth={1.75}
        className="text-ink-300 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-300">
          {label}
        </div>
        <div
          className={cn(
            'text-[13px] text-ink-50 truncate',
            tabular && 'tabular-nums',
          )}
        >
          {value}
        </div>
      </div>
    </div>
  )
}
