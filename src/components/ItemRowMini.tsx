import { Link } from 'react-router-dom'
import { useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { type ItemAnalytic } from '@/lib/analytics'
import { type Item } from '@/db/dexie'
import { getItemPhoto } from '@/db/items'
import { cn } from '@/lib/utils'

interface RightSlot {
  value: ReactNode
  /** Small label-caps suffix below the value. */
  suffix?: string
  /** Small prefix before the value (e.g. "₹"), rendered tertiary. */
  prefix?: string
  /** Color the suffix — accent for "good" leaderboards (Best CPW),
   *  warning for "bad" (Worst CPW). */
  tone?: 'default' | 'accent' | 'warning'
}

interface Props {
  analytic: ItemAnalytic
  right?: RightSlot
  /** Render the row with reduced saturation — used for Dormant. */
  desaturate?: boolean
}

/** Compact row used in editorial leaderboards (Most worn / Best CPW / Dormant). */
export function ItemRowMini({ analytic, right, desaturate }: Props) {
  const { item } = analytic

  return (
    <Link
      to={`/closet/${item.id}`}
      className={cn(
        'flex items-center gap-4 py-3 -mx-2 px-2 rounded-lg hover:bg-surface-2/50 transition-colors',
        desaturate && 'opacity-70',
      )}
    >
      <RowThumb item={item} desaturate={desaturate} />
      <div className="flex-1 min-w-0">
        <div className="text-[15px] text-ink-50 truncate">{item.name}</div>
        <div className="text-[12px] text-tertiary truncate">
          {[item.category, item.brand].filter(Boolean).join(' · ') || '—'}
        </div>
      </div>
      {right && (
        <div className="text-right shrink-0">
          <div className="text-[16px] text-ink-50 tabular-nums leading-none">
            {right.prefix && (
              <span className="text-tertiary mr-0.5">{right.prefix}</span>
            )}
            {right.value}
          </div>
          {right.suffix && (
            <div
              className={cn(
                'mt-1 text-[10px] font-semibold uppercase tracking-wider',
                right.tone === 'accent' && 'text-accent',
                right.tone === 'warning' && 'text-warning',
                (!right.tone || right.tone === 'default') && 'text-tertiary',
              )}
            >
              {right.suffix}
            </div>
          )}
        </div>
      )}
    </Link>
  )
}

function RowThumb({ item, desaturate }: { item: Item; desaturate?: boolean }) {
  const photo = useLiveQuery(
    () =>
      item.primaryPhotoId
        ? getItemPhoto(item.primaryPhotoId)
        : Promise.resolve(undefined),
    [item.primaryPhotoId],
  )

  const [url, setUrl] = useState<string | undefined>()

  useEffect(() => {
    if (!photo?.blob) {
      setUrl(undefined)
      return
    }
    const u = URL.createObjectURL(photo.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [photo?.blob])

  return (
    <div
      className={cn(
        'h-16 w-16 shrink-0 rounded-lg overflow-hidden bg-surface-2 border border-hairline flex items-center justify-center',
        desaturate && 'grayscale',
      )}
    >
      {url ? (
        <img
          src={url}
          alt={item.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-tertiary text-[10px] text-center px-1">
          {item.name.slice(0, 2)}
        </span>
      )}
    </div>
  )
}
