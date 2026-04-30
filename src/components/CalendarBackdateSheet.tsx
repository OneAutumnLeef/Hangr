import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Sheet } from './Sheet'
import { listRecentWearDays } from '@/db/wears'
import { addDays, startOfDay } from '@/lib/dates'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  /** Fires with a start-of-day ms when the user picks a cell. The parent is
   *  responsible for closing the sheet and opening its picker for that day. */
  onSelect: (dayMs: number) => void
}

const WINDOW_DAYS = 35 // 5 rows × 7 cols, today anchored rightmost on row 5

/**
 * Calendar grid for backdating. Shows the last 35 days laid out Mon–Sun-ish
 * (calendar-aligned), with a small accent dot on days that already have logs.
 * Tap any cell to open the day picker for that date — a much faster way to
 * fill a vacation week than per-item backdating from Item Detail.
 *
 * Keeping this to a 35-day window (rather than a real month grid) so we
 * always have exactly 5 rows of 7 — predictable on small screens, no jagged
 * leading-blanks.
 */
export function CalendarBackdateSheet({ open, onClose, onSelect }: Props) {
  const today = startOfDay()
  const days = useMemo(() => {
    const arr: number[] = []
    for (let i = WINDOW_DAYS - 1; i >= 0; i--) arr.push(addDays(today, -i))
    return arr
  }, [today])

  const wearDays = useLiveQuery(() => listRecentWearDays(WINDOW_DAYS))
  const wearCountByDay = new Map<number, number>()
  if (wearDays) {
    for (const d of wearDays) wearCountByDay.set(d.dayMs, d.itemIds.length)
  }

  // Mon-anchored weekday header above the grid. Tweak to match the grid we
  // produce: each row is 7 days, oldest at start, today at right end.
  const weekdayHeaders = useMemo(() => {
    const fmt = new Intl.DateTimeFormat('en-IN', { weekday: 'short' })
    return days.slice(0, 7).map((d) => fmt.format(new Date(d)))
  }, [days])

  return (
    <Sheet open={open} onClose={onClose} title="Pick a day">
      <div className="px-4 py-3">
        <div className="grid grid-cols-7 gap-1.5 mb-2">
          {weekdayHeaders.map((w, i) => (
            <div
              key={i}
              className="text-[10px] font-semibold uppercase tracking-wider text-tertiary text-center"
            >
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const count = wearCountByDay.get(d) ?? 0
            const dayNum = new Date(d).getDate()
            const isToday = d === today
            const monthStart = new Date(d).getDate() === 1
            return (
              <button
                key={d}
                type="button"
                onClick={() => onSelect(d)}
                className={cn(
                  'relative aspect-square rounded-card flex flex-col items-center justify-center text-[13px] tabular-nums transition-colors',
                  count > 0
                    ? 'bg-surface-2 border border-hairline text-ink-50 hover:border-accent/40'
                    : 'bg-surface-1 border border-hairline text-tertiary hover:text-ink-50 hover:border-accent/40',
                  isToday && 'ring-1 ring-accent',
                )}
                aria-label={`${count} item${count === 1 ? '' : 's'} logged`}
              >
                {monthStart && (
                  <span className="absolute top-1 left-1.5 text-[8px] font-semibold uppercase tracking-wider text-accent leading-none">
                    {new Intl.DateTimeFormat('en-IN', { month: 'short' })
                      .format(new Date(d))
                      .toUpperCase()}
                  </span>
                )}
                <span>{dayNum}</span>
                {count > 0 && (
                  <span className="mt-0.5 h-1 w-1 rounded-full bg-accent" />
                )}
              </button>
            )
          })}
        </div>
        <div className="mt-4 text-[11px] text-tertiary text-center leading-relaxed">
          Tap any day to log or backfill items. Days with logs show a dot.
        </div>
      </div>
    </Sheet>
  )
}
