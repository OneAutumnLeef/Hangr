import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  bestCostPerWear,
  buyersRegret,
  dormantItems,
  loadAllAnalytics,
  mostWorn,
  topWornColors,
  worstCostPerWear,
} from '@/lib/analytics'
import { colorNameToHex } from '@/lib/colors'
import { daysBetween, startOfDay } from '@/lib/dates'
import { StatTile } from '@/components/StatTile'
import { ItemRowMini } from '@/components/ItemRowMini'
import { ItemPairRow } from '@/components/ItemPairRow'
import { WearTrendChart } from '@/components/WearTrendChart'
import { EmptyState } from '@/components/EmptyState'
import { HangerIcon } from '@/components/HangerIcon'

export function Insights() {
  const navigate = useNavigate()
  const data = useLiveQuery(() => loadAllAnalytics())

  if (!data) {
    return (
      <div className="px-5 pt-12 max-w-md mx-auto space-y-4">
        <div className="h-8 w-32 rounded-md bg-surface-2 animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          <div className="aspect-square rounded-xl bg-surface-1 animate-pulse" />
          <div className="aspect-square rounded-xl bg-surface-1 animate-pulse" />
        </div>
      </div>
    )
  }

  const { stats, items, weeklyWearCounts } = data

  if (stats.totalItems === 0) {
    return (
      <div className="px-5 pt-12 max-w-md mx-auto">
        <h1 className="font-display text-[28px] font-semibold tracking-tight text-ink-50 leading-tight mb-6">
          Insights
        </h1>
        <EmptyState
          icon={<HangerIcon className="h-12 w-12" />}
          title="Nothing to report yet"
          message="Add some items and log a few wears. Your honesty report shows up here."
          actionLabel="Add an item"
          onAction={() => navigate('/capture')}
        />
      </div>
    )
  }

  const best = bestCostPerWear(items, 5)
  const worst = worstCostPerWear(items, 5)
  // Dormant threshold is 60 days per design spec ("not worn in 60+ days").
  const dormant = dormantItems(items, 60)
  const popular = mostWorn(items, 5)
  const regret = buyersRegret(items, 90)
  const colorPalette = topWornColors(items, 5)
  // Donation candidates: items unworn 6+ months that have a price set, so the
  // "₹ tied up" framing is meaningful. A separate, sterner ask than Dormant.
  const donationList = dormantItems(items, 180).filter(
    (a) => a.item.purchasePriceMinor != null,
  )
  const donationTiedUpMinor = donationList.reduce(
    (sum, a) => sum + (a.item.purchasePriceMinor ?? 0),
    0,
  )

  // Active = items with at least one wear (real or seed). Surfaces the
  // "% of closet that's earning its keep" signal.
  const activeCount = items.filter((a) => a.wearCount > 0).length
  const activePercent =
    stats.totalItems > 0
      ? Math.round((activeCount / stats.totalItems) * 100)
      : 0

  return (
    <div className="px-5 pt-12 pb-4 max-w-md mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-[28px] font-semibold tracking-tight text-ink-50 leading-tight">
          Insights
        </h1>
        <p className="mt-1 text-[15px] text-ink-300">
          Your wardrobe, honestly.
        </p>
      </header>

      {/* Bento stats grid */}
      <section className="grid grid-cols-2 gap-3 mb-6">
        <StatTile label="Wears" value={stats.totalWears} />
        <StatTile label="Active" value={`${activePercent}%`} tone="accent" />
        <StatTile
          label="Avg / wear"
          value={
            stats.avgCostPerWear != null
              ? Math.round(stats.avgCostPerWear).toLocaleString('en-IN')
              : '—'
          }
          prefix={stats.avgCostPerWear != null ? '₹' : undefined}
        />
        <StatTile
          label="Dormant"
          value={dormant.length}
          tone={dormant.length > 0 ? 'danger' : 'default'}
        />
      </section>

      {/* Wear trend */}
      <section className="mb-10">
        <WearTrendChart data={weeklyWearCounts} />
      </section>

      {/* Forgotten pairs — combos worn together historically, dormant now */}
      {data.dormantPairs.length > 0 && (
        <Section
          title="Forgotten pairs"
          subtitle="Combos you used to reach for. Maybe again?"
        >
          {data.dormantPairs.slice(0, 4).map((p) => (
            <ItemPairRow
              key={`${p.itemA.id}-${p.itemB.id}`}
              pair={p}
            />
          ))}
        </Section>
      )}

      {/* Most worn */}
      {popular.length > 0 && (
        <Section title="Most worn">
          {popular.map((a) => (
            <ItemRowMini
              key={a.item.id}
              analytic={a}
              right={{
                value: a.wearCount,
                suffix: a.wearCount === 1 ? 'Wear' : 'Wears',
              }}
            />
          ))}
        </Section>
      )}

      {/* Best CPW */}
      {best.length > 0 && (
        <Section title="Best cost-per-wear">
          {best.map((a) => (
            <ItemRowMini
              key={a.item.id}
              analytic={a}
              right={{
                prefix: '₹',
                value:
                  a.costPerWear != null
                    ? Math.round(a.costPerWear).toLocaleString('en-IN')
                    : '—',
                suffix: 'CPW',
                tone: 'accent',
              }}
            />
          ))}
        </Section>
      )}

      {/* Worst CPW */}
      {worst.length > 0 && (
        <Section title="Highest cost / wear">
          {worst.map((a) => (
            <ItemRowMini
              key={a.item.id}
              analytic={a}
              right={{
                prefix: '₹',
                value:
                  a.costPerWear != null
                    ? Math.round(a.costPerWear).toLocaleString('en-IN')
                    : '—',
                suffix: 'CPW',
                tone: 'warning',
              }}
            />
          ))}
        </Section>
      )}

      {/* Buyer's regret — recently bought, never worn */}
      {regret.length > 0 && (
        <Section
          title="Buyer's regret"
          subtitle="Bought in the last 90 days, still unworn."
        >
          {regret.slice(0, 5).map((a) => {
            const daysAgo = daysBetween(a.item.purchasedAt!, startOfDay())
            return (
              <ItemRowMini
                key={a.item.id}
                analytic={a}
                right={{
                  value: daysAgo === 0 ? 'today' : daysAgo,
                  suffix:
                    daysAgo === 0
                      ? 'bought'
                      : daysAgo === 1
                        ? 'day ago'
                        : 'days ago',
                  tone: 'warning',
                }}
              />
            )
          })}
          {regret.length > 5 && (
            <div className="pt-3 text-xs text-tertiary">
              + {regret.length - 5} more
            </div>
          )}
        </Section>
      )}

      {/* Donation candidates — sterner than Dormant; priced items unworn 6mo+ */}
      {donationList.length > 0 && (
        <Section
          title="Worth letting go?"
          subtitle={`${donationList.length} item${donationList.length === 1 ? '' : 's'} unworn 6+ months · ₹${(donationTiedUpMinor / 100).toLocaleString('en-IN')} originally spent.`}
        >
          {donationList.slice(0, 8).map((a) => (
            <ItemRowMini
              key={a.item.id}
              analytic={a}
              desaturate
              right={{
                prefix: '₹',
                value: (a.item.purchasePriceMinor! / 100).toLocaleString(
                  'en-IN',
                ),
                suffix:
                  a.wearCount === 0
                    ? 'Never worn'
                    : `${a.daysSinceLastWear}d dormant`,
                tone: 'warning',
              }}
            />
          ))}
          {donationList.length > 8 && (
            <div className="pt-3 text-xs text-tertiary">
              + {donationList.length - 8} more
            </div>
          )}
        </Section>
      )}

      {/* Dormant */}
      {dormant.length > 0 && (
        <Section title="Dormant">
          {dormant.slice(0, 10).map((a) => {
            const value =
              a.wearCount === 0 ? 'Never' : (a.daysSinceLastWear ?? '—')
            const suffix = a.wearCount === 0 ? 'Worn' : 'Days'
            return (
              <ItemRowMini
                key={a.item.id}
                analytic={a}
                desaturate
                right={{ value, suffix }}
              />
            )
          })}
          {dormant.length > 10 && (
            <div className="pt-3 text-xs text-tertiary">
              + {dormant.length - 10} more
            </div>
          )}
        </Section>
      )}

      {/* By category */}
      {data.byCategory.length > 0 && (
        <Section title="By category">
          <div className="space-y-3 pt-3">
            {data.byCategory.map((c) => {
              const pct =
                stats.totalItems > 0
                  ? Math.round((c.count / stats.totalItems) * 100)
                  : 0
              return (
                <div key={c.category}>
                  <div className="flex items-baseline justify-between text-[13px]">
                    <span className="text-ink-50">{c.category}</span>
                    <span className="text-tertiary tabular-nums">
                      {c.count}
                      {c.spentMinor > 0 && (
                        <>
                          {' '}
                          · ₹
                          {(c.spentMinor / 100).toLocaleString('en-IN')}
                        </>
                      )}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent/80"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* Color palette — what you actually reach for, weighted by wears */}
      {colorPalette.length > 0 && (
        <Section
          title="Worn colours"
          subtitle="Weighted by wears, not by what you own."
        >
          <div className="space-y-3 pt-3">
            {colorPalette.map((c) => {
              const peak = colorPalette[0].wearCount
              const pct = peak > 0 ? Math.round((c.wearCount / peak) * 100) : 0
              return (
                <div key={c.name}>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-hairline shrink-0"
                        style={{ backgroundColor: colorNameToHex(c.name) }}
                        aria-hidden
                      />
                      <span className="text-ink-50 truncate">{c.name}</span>
                    </span>
                    <span className="text-tertiary tabular-nums">
                      {c.wearCount}{' '}
                      {c.wearCount === 1 ? 'wear' : 'wears'} ·{' '}
                      {c.itemCount}{' '}
                      {c.itemCount === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: colorNameToHex(c.name),
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      <div className="mt-8 text-[11px] text-tertiary text-center">
        All numbers computed locally from your data.
      </div>
    </div>
  )
}

/** Editorial section header — Fraunces italic with a hairline underline. */
function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-10">
      <h2 className="font-display italic text-[20px] font-medium text-ink-50 tracking-tight border-b border-hairline pb-2">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-2 text-[12px] text-tertiary leading-relaxed">
          {subtitle}
        </p>
      )}
      <div className={subtitle ? 'mt-1' : 'mt-1'}>{children}</div>
    </section>
  )
}
