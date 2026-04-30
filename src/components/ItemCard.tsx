import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { type Item } from '@/db/dexie'
import { getItemPhoto } from '@/db/items'
import { cn } from '@/lib/utils'

interface Props {
  item: Item
  /** Total wears (real + seed). Pass from Closet so we don't N+1 query. */
  wearCount?: number
}

export function ItemCard({ item, wearCount }: Props) {
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

  const isCutout = photo?.isProcessed
  const totalWears = wearCount ?? 0
  const isWorn = totalWears > 0

  return (
    <Link
      to={`/closet/${item.id}`}
      className="group block rounded-card overflow-hidden bg-surface-1 border border-hairline active:scale-[0.98] transition-transform"
    >
      <div
        className={cn(
          'aspect-square relative overflow-hidden flex items-center justify-center',
          isCutout ? 'bg-checker' : 'bg-surface-2',
        )}
      >
        {url ? (
          <img
            src={url}
            alt={item.name}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <div className="text-tertiary text-xs">No photo</div>
        )}

        {wearCount != null && (
          <div className="absolute top-2 right-2 bg-ink-950/80 backdrop-blur-sm border border-hairline rounded-full px-2 py-1 flex items-center gap-1.5">
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                isWorn ? 'bg-accent' : 'bg-tertiary',
              )}
            />
            <span
              className={cn(
                'text-[10px] font-medium tabular-nums tracking-wide',
                isWorn ? 'text-accent' : 'text-ink-300',
              )}
            >
              worn {totalWears}×
            </span>
          </div>
        )}
      </div>

      <div className="px-3 py-2.5">
        {item.category && (
          <p className="text-[10px] font-medium text-ink-300 uppercase tracking-wider mb-1 truncate">
            {item.category}
          </p>
        )}
        <h3 className="font-display text-[15px] leading-tight font-medium text-ink-50 truncate">
          {item.name}
        </h3>
      </div>
    </Link>
  )
}
