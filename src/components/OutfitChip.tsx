import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Item, Outfit } from '@/db/dexie'
import { getItemPhoto, listItems } from '@/db/items'

interface Props {
  outfit: Outfit
  onClick?: () => void
}

/**
 * Compact saved-outfit card for the Log rail. Shows up to 4 member items in
 * a 2x2 grid below the name. Tapping is the entry point to the detail sheet.
 */
export function OutfitChip({ outfit, onClick }: Props) {
  const items = useLiveQuery(() => listItems({ includeArchived: true }))
  const itemMap = new Map<string, Item>()
  if (items) for (const it of items) itemMap.set(it.id, it)
  const tileItems = outfit.itemIds.slice(0, 4).map((id) => itemMap.get(id))

  return (
    <button
      onClick={onClick}
      className="snap-start shrink-0 w-40 flex flex-col items-stretch gap-2 group text-left"
    >
      <div className="grid grid-cols-2 gap-1 rounded-card bg-surface-1 border border-hairline overflow-hidden aspect-square p-2 group-active:scale-[0.98] transition-transform">
        {[0, 1, 2, 3].map((i) => (
          <OutfitTile key={i} item={tileItems[i]} />
        ))}
      </div>
      <div>
        <div className="text-[13px] text-ink-50 truncate">{outfit.name}</div>
        <div className="text-[11px] text-tertiary tabular-nums">
          {outfit.itemIds.length}{' '}
          {outfit.itemIds.length === 1 ? 'item' : 'items'}
        </div>
      </div>
    </button>
  )
}

function OutfitTile({ item }: { item?: Item }) {
  const photo = useLiveQuery(
    () =>
      item?.primaryPhotoId
        ? getItemPhoto(item.primaryPhotoId)
        : Promise.resolve(undefined),
    [item?.primaryPhotoId],
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

  if (!item) {
    return <div className="bg-surface-2/40 rounded-md" />
  }
  return (
    <div className="bg-surface-2 rounded-md overflow-hidden flex items-center justify-center">
      {url ? (
        <img
          src={url}
          alt=""
          className="max-h-full max-w-full object-contain"
        />
      ) : (
        <div className="text-tertiary text-[9px] text-center px-1">
          {item.name.slice(0, 2)}
        </div>
      )}
    </div>
  )
}
