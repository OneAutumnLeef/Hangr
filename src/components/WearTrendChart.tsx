import { type WeeklyBucket } from '@/lib/analytics'

interface Props {
  data: WeeklyBucket[]
}

/** Tiny dependency-free bar chart of weekly wear counts. */
export function WearTrendChart({ data }: Props) {
  const max = Math.max(1, ...data.map((d) => d.count))
  const total = data.reduce((s, d) => s + d.count, 0)

  return (
    <div>
      <div className="flex items-end gap-1 h-24">
        {data.map((d) => {
          const h = max > 0 ? Math.max(2, (d.count / max) * 100) : 2
          return (
            <div
              key={d.weekStart}
              className="flex-1 flex flex-col items-center justify-end"
              title={`${d.label}: ${d.count}`}
            >
              <div
                className="w-full rounded-t-md bg-accent/80 hover:bg-accent transition"
                style={{ height: `${h}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-ink-500">
        <span>{data[0]?.label}</span>
        <span>{total} wears · 12 weeks</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  )
}
