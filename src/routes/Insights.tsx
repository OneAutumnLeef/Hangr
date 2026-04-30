import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  TrendingUp,
  Sparkles,
  AlertTriangle,
  Award,
  BarChart3,
  PiggyBank,
} from 'lucide-react'
import {
  bestCostPerWear,
  dormantItems,
  formatRupees,
  loadAllAnalytics,
  mostWorn,
  worstCostPerWear,
} from '@/lib/analytics'
import { StatTile } from '@/components/StatTile'
import { ItemRowMini } from '@/components/ItemRowMini'
import { WearTrendChart } from '@/components/WearTrendChart'
import { EmptyState } from '@/components/EmptyState'
import { HangerIcon } from '@/components/HangerIcon'

export function Insights() {
  const navigate = useNavigate()
  const data = useLiveQuery(() => loadAllAnalytics())

  if (!data) {
    return (
      <div className="px-4 pt-12 max-w-md mx-auto space-y-4">
        <div className="h-8 w-32 rounded-md bg-ink-800 animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-24 rounded-2xl bg-ink-800 animate-pulse" />
          <div className="h-24 rounded-2xl bg-ink-800 animate-pulse" />
        </div>
      </div>
    )
  }

  const { stats, items, weeklyWearCounts } = data

  if (stats.totalItems === 0) {
    return (
      <div className="px-4 pt-16 max-w-md mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Insights</h1>
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
  const dormant = dormantItems(items, 30)
  const popular = mostWorn(items, 5)

  return (
    <div className="px-4 pt-12 pb-4 max-w-md mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Insights</h1>
        <p className="text-sm text-ink-400">
          The honest version of your closet
        </p>
      </header>

      {/* Top-line stats */}
      <section className="grid grid-cols-2 gap-3 mb-6">
        <StatTile label="Items" value={stats.totalItems} />
        <StatTile
          label="Total spent"
          value={formatRupees(stats.totalSpentMinor)}
        />
        <StatTile label="Total wears" value={stats.totalWears} />
        <StatTile
          label="Avg cost / wear"
          value={
            stats.avgCostPerWear != null
              ? `₹${Math.round(stats.avgCostPerWear).toLocaleString('en-IN')}`
              : '—'
          }
        />
      </section>

      {/* Wear trend */}
      <section className="mb-6 rounded-2xl bg-ink-800 border border-ink-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={16} className="text-accent" />
          <h2 className="text-sm font-medium">Wear trend · 12 weeks</h2>
        </div>
        <WearTrendChart data={weeklyWearCounts} />
      </section>

      {/* Most worn */}
      {popular.length > 0 && (
        <Section
          icon={<Award size={16} />}
          title="Most worn"
          subtitle="The actual workhorses of your wardrobe"
        >
          {popular.map((a) => (
            <ItemRowMini key={a.item.id} analytic={a} />
          ))}
        </Section>
      )}

      {/* Best CPW (most savings) */}
      {best.length > 0 && (
        <Section
          icon={<PiggyBank size={16} />}
          title="Best deals"
          subtitle="Lowest cost-per-wear — your wallet is happy"
        >
          {best.map((a) => (
            <ItemRowMini
              key={a.item.id}
              analytic={a}
              rightLabel={
                a.costPerWear != null
                  ? `₹${Math.round(a.costPerWear).toLocaleString('en-IN')}`
                  : '—'
              }
              rightHint={`${a.wearCount} wears`}
            />
          ))}
        </Section>
      )}

      {/* Worst CPW */}
      {worst.length > 0 && (
        <Section
          icon={<AlertTriangle size={16} />}
          title="Highest cost / wear"
          subtitle="Get more wears out of these to bring the cost down"
        >
          {worst.map((a) => (
            <ItemRowMini
              key={a.item.id}
              analytic={a}
              rightLabel={
                a.costPerWear != null
                  ? `₹${Math.round(a.costPerWear).toLocaleString('en-IN')}`
                  : '—'
              }
              rightHint={`${a.wearCount} wear${a.wearCount === 1 ? '' : 's'}`}
            />
          ))}
        </Section>
      )}

      {/* Dormant */}
      {dormant.length > 0 && (
        <Section
          icon={<TrendingUp size={16} className="rotate-180" />}
          title={`Dormant · ${dormant.length}`}
          subtitle="Haven't been worn in 30+ days (or ever)"
        >
          {dormant.slice(0, 10).map((a) => {
            const right =
              a.wearCount === 0
                ? 'Never worn'
                : `${a.daysSinceLastWear ?? '—'}d ago`
            const hint = a.item.purchasePriceMinor
              ? `₹${(a.item.purchasePriceMinor / 100).toLocaleString('en-IN')}`
              : ''
            return (
              <ItemRowMini
                key={a.item.id}
                analytic={a}
                rightLabel={right}
                rightHint={hint}
              />
            )
          })}
          {dormant.length > 10 && (
            <div className="pt-2 text-xs text-ink-500">
              + {dormant.length - 10} more
            </div>
          )}
        </Section>
      )}

      {/* By category */}
      {data.byCategory.length > 0 && (
        <Section
          icon={<Sparkles size={16} />}
          title="By category"
          subtitle="Where your closet (and money) actually lives"
        >
          <div className="space-y-2">
            {data.byCategory.map((c) => {
              const pct =
                stats.totalItems > 0
                  ? Math.round((c.count / stats.totalItems) * 100)
                  : 0
              return (
                <div key={c.category} className="py-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ink-100">{c.category}</span>
                    <span className="text-ink-400 tabular-nums">
                      {c.count} · {formatRupees(c.spentMinor)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 bg-ink-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent/70"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      <div className="mt-6 text-xs text-ink-500 text-center">
        All numbers computed locally from your data.
      </div>
    </div>
  )
}

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-accent">{icon}</span>
        <h2 className="text-sm font-medium">{title}</h2>
      </div>
      {subtitle && (
        <div className="text-xs text-ink-500 mb-2">{subtitle}</div>
      )}
      <div className="rounded-2xl bg-ink-800 border border-ink-800 px-3 py-2 divide-y divide-ink-900/60">
        {children}
      </div>
    </section>
  )
}
