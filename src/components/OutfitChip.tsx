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
      className="shrink-0 w-28 flex flex-col items-stretch gap-1.5 group"
    >
      <div className="grid grid-cols-2 gap-0.5 rounded-xl bg-ink-900 border border-ink-800 overflow-hidden aspect-square p-1 group-active:scale-95 transition">
        {[0, 1, 2, 3].map((i) => (
          <OutfitTile key={i} item={tileItems[i]} />
        ))}
      </div>
      <div className="text-xs text-ink-100 truncate text-left px-0.5">
        {outfit.name}
      </div>
      <div className="text-[10px] text-ink-500 px-0.5 text-left">
        {outfit.itemIds.length}{' '}
        {outfit.itemIds.length === 1 ? 'item' : 'items'}
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
    return <div className="bg-ink-800/40 rounded-md" />
  }
  return (
    <div className="bg-ink-800 rounded-md overflow-hidden flex items-center justify-center">
      {url ? (
        <img
          src={url}
          alt=""
          className="max-h-full max-w-full object-contain"
        />
      ) : (
        <div className="text-ink-500 text-[9px] text-center px-1">
          {item.name.slice(0, 2)}
        </div>
      )}
    </div>
  )
}
