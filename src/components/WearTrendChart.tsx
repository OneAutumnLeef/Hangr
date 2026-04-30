import { useState } from 'react'
import { type WeeklyBucket } from '@/lib/analytics'
import { cn } from '@/lib/utils'

interface Props {
  data: WeeklyBucket[]
}

/**
 * Tiny dependency-free bar chart of weekly wear counts.
 *
 * Visual rules:
 *   - Peak week gets the lime fill plus its count above the bar (gives an
 *     implicit y-scale without a full axis).
 *   - Other non-zero weeks sit in surface-2; zero weeks render as a faint
 *     hairline stub anchored to a baseline rule, so empty stretches stay
 *     legible against the surface-1 card.
 *   - A dashed average line (mean wears / week across the 12-week window)
 *     gives quick "above or below the line" context. Hidden when only one
 *     week has data — the average is meaningless then.
 *
 * Interaction:
 *   - Each bar is a button. Tap to surface that week's count + label in the
 *     header (the `title=` tooltip alone is unreachable on mobile). Tap the
 *     same bar again to clear.
 */
export function WearTrendChart({ data }: Props) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

  const max = Math.max(0, ...data.map((d) => d.count))
  const total = data.reduce((s, d) => s + d.count, 0)
  const peakIndex = max > 0 ? data.findIndex((d) => d.count === max) : -1
  const nonEmptyWeeks = data.filter((d) => d.count > 0).length
  // Mean across all 12 weeks — a quiet stretch dragging it down is the
  // honest signal we want to surface.
  const avg = data.length > 0 ? total / data.length : 0
  const avgPct = max > 0 ? (avg / max) * 100 : 0

  const selected = selectedIdx != null ? data[selectedIdx] : null

  return (
    <div className="rounded-card bg-surface-1 border border-hairline p-4">
      <div className="flex items-baseline justify-between mb-3 min-h-[14px]">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-300">
          12-week activity
        </span>
        {selected ? (
          <span className="text-[11px] tabular-nums">
            <span className="font-semibold text-ink-50">
              {selected.count}
            </span>
            <span className="text-tertiary">
              {' '}
              {selected.count === 1 ? 'wear' : 'wears'} · {selected.label}
            </span>
          </span>
        ) : (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-tertiary tabular-nums">
            {total} {total === 1 ? 'wear' : 'wears'}
            {nonEmptyWeeks > 1 && (
              <>
                {' '}
                · avg {avg.toFixed(1).replace(/\.0$/, '')}/wk
              </>
            )}
          </span>
        )}
      </div>

      {max === 0 ? (
        <div className="h-28 flex items-center justify-center text-[12px] text-tertiary">
          No wears logged yet — log a few from the Log tab.
        </div>
      ) : (
        // NOTE: do NOT use `items-end` here. The bar's `height: X%` resolves
        // against the column's height; without `align-items: stretch` (the
        // default), columns shrink to intrinsic auto and the percentage
        // collapses to 0 — bars vanish.
        <div className="relative h-28">
          {/* Average line — dashed, sits above bars but below selection ring */}
          {nonEmptyWeeks > 1 && (
            <div
              className="absolute left-0 right-0 border-t border-dashed border-tertiary/50 pointer-events-none z-[1]"
              style={{ bottom: `${avgPct}%` }}
              aria-hidden
            />
          )}

          {/* Baseline hairline so empty weeks visibly anchor to a floor */}
          <div
            className="absolute left-0 right-0 bottom-0 border-t border-hairline pointer-events-none"
            aria-hidden
          />

          <div className="flex gap-1 h-full">
            {data.map((d, i) => {
              const isPeak = i === peakIndex
              const isSelected = i === selectedIdx
              const isEmpty = d.count === 0
              const h = isEmpty ? 4 : Math.max(6, (d.count / max) * 100)

              return (
                <button
                  type="button"
                  key={d.weekStart}
                  onClick={() => setSelectedIdx(isSelected ? null : i)}
                  aria-label={`${d.label}: ${d.count} ${d.count === 1 ? 'wear' : 'wears'}`}
                  aria-pressed={isSelected}
                  title={`${d.label}: ${d.count}`}
                  className="relative flex-1 flex flex-col items-center justify-end group"
                >
                  {/* Peak count above the peak bar (always visible, gives
                      implicit y-scale). Hidden when peak is the selected bar
                      — the header already shows the count then. */}
                  {isPeak && !isSelected && d.count > 0 && (
                    <span className="absolute -top-0.5 text-[9px] font-semibold tabular-nums text-accent leading-none">
                      {d.count}
                    </span>
                  )}

                  <div
                    className={cn(
                      'w-full rounded-t-sm transition-colors',
                      isSelected
                        ? 'bg-accent'
                        : isPeak
                          ? 'bg-accent'
                          : isEmpty
                            ? 'bg-hairline'
                            : 'bg-surface-2 group-hover:bg-tertiary/60',
                    )}
                    style={{ height: `${h}%` }}
                  />
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-[10px] text-tertiary tabular-nums">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  )
}
