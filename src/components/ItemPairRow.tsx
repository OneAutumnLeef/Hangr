import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import type { DormantPair } from '@/lib/analytics'
import { type Item } from '@/db/dexie'
import { getItemPhoto } from '@/db/items'
import { cn } from '@/lib/utils'

interface Props {
  pair: DormantPair
}

/**
 * Editorial row for the "forgotten pairs" insight. Two thumbnails on the
 * left, names stacked, "worn together N times · X days ago" on the right.
 * Tapping either thumb jumps to that item; tapping the row body falls
 * through to the first item's detail.
 */
export function ItemPairRow({ pair }: Props) {
  const { itemA, itemB, togetherCount, daysSinceLastShared } = pair
  return (
    <div className="flex items-center gap-4 py-3 -mx-2 px-2 rounded-lg hover:bg-surface-2/50 transition-colors">
      <div className="flex -space-x-3 shrink-0">
        <PairThumb item={itemA} z={2} />
        <PairThumb item={itemB} z={1} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] text-ink-50 truncate">
          <Link to={`/closet/${itemA.id}`} className="hover:text-accent">
            {itemA.name}
          </Link>
          <span className="text-tertiary"> + </span>
          <Link to={`/closet/${itemB.id}`} className="hover:text-accent">
            {itemB.name}
          </Link>
        </div>
        <div className="text-[12px] text-tertiary tabular-nums">
          {togetherCount}× together · {daysSinceLastShared}d ago
        </div>
      </div>
    </div>
  )
}

function PairThumb({ item, z }: { item: Item; z: number }) {
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
        'h-12 w-12 rounded-full overflow-hidden bg-surface-2 border-2 border-surface-1 flex items-center justify-center',
      )}
      style={{ zIndex: z }}
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
