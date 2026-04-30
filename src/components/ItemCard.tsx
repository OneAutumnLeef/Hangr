import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { type Item } from '@/db/dexie'
import { getItemPhoto } from '@/db/items'

interface Props {
  item: Item
}

export function ItemCard({ item }: Props) {
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

  const meta = [item.category, item.color, item.brand].filter(Boolean).join(' · ')

  return (
    <Link
      to={`/closet/${item.id}`}
      className="block rounded-2xl overflow-hidden bg-ink-800 border border-ink-800 active:scale-[0.98] transition"
    >
      <div className="aspect-square bg-ink-900 flex items-center justify-center overflow-hidden">
        {url ? (
          <img
            src={url}
            alt={item.name}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <div className="text-ink-500 text-xs">No photo</div>
        )}
      </div>
      <div className="px-3 py-2">
        <div className="text-sm font-medium truncate">{item.name}</div>
        <div className="text-xs text-ink-400 truncate">{meta || '—'}</div>
      </div>
    </Link>
  )
}
