import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { type Item } from '@/db/dexie'
import { getItemPhoto } from '@/db/items'
import { cn } from '@/lib/utils'

interface Props {
  item: Item
  size?: 'sm' | 'md' | 'lg'
  selected?: boolean
  onClick?: () => void
}

const SIZE_CLASS: Record<NonNullable<Props['size']>, string> = {
  sm: 'h-12 w-12',
  md: 'h-20 w-20',
  lg: 'h-28 w-28',
}

/** Compact square photo of an item — used in outfit lists / pickers. */
export function MiniItemThumb({
  item,
  size = 'md',
  selected,
  onClick,
}: Props) {
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

  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-xl overflow-hidden bg-surface-2 border-2 flex items-center justify-center transition-colors',
        SIZE_CLASS[size],
        selected ? 'border-accent' : 'border-transparent',
      )}
      title={item.name}
    >
      {url ? (
        <img
          src={url}
          alt={item.name}
          className="max-h-full max-w-full object-contain"
        />
      ) : (
        <div className="text-tertiary text-[10px] px-1 text-center">
          {item.name.slice(0, 2)}
        </div>
      )}
    </Tag>
  )
}
