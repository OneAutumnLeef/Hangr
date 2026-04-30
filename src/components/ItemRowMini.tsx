import { Link } from 'react-router-dom'
import { type ItemAnalytic } from '@/lib/analytics'
import { MiniItemThumb } from './MiniItemThumb'
import { relativeDayLabel } from '@/lib/dates'

interface Props {
  analytic: ItemAnalytic
  /** Optional right-side text override (e.g. CPW string). */
  rightLabel?: string
  /** Right subtitle. */
  rightHint?: string
}

/** Compact row used in leaderboards (best/worst CPW, dormant, most-worn). */
export function ItemRowMini({ analytic, rightLabel, rightHint }: Props) {
  const { item, wearCount, lastWornAt, daysSinceLastWear } = analytic

  const defaultLabel =
    wearCount > 0
      ? `${wearCount} wear${wearCount === 1 ? '' : 's'}`
      : 'Never worn'
  const defaultHint =
    lastWornAt != null
      ? relativeDayLabel(lastWornAt)
      : daysSinceLastWear != null
        ? `${daysSinceLastWear}d`
        : ''

  return (
    <Link
      to={`/closet/${item.id}`}
      className="flex items-center gap-3 py-2 active:bg-ink-800/50 -mx-2 px-2 rounded-lg transition"
    >
      <MiniItemThumb item={item} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-ink-100 truncate">{item.name}</div>
        <div className="text-xs text-ink-500 truncate">
          {[item.category, item.brand].filter(Boolean).join(' · ') || '—'}
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm text-ink-100 tabular-nums">
          {rightLabel ?? defaultLabel}
        </div>
        <div className="text-xs text-ink-500">{rightHint ?? defaultHint}</div>
      </div>
    </Link>
  )
}
