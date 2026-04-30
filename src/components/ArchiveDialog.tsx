import { useState } from 'react'
import { type ArchivedReason } from '@/db/dexie'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: (reason: ArchivedReason | undefined, note?: string) => void
  itemName?: string
  busy?: boolean
}

const REASONS: { value: ArchivedReason; label: string; hint?: string }[] = [
  { value: 'donated', label: 'Donated' },
  { value: 'sold', label: 'Sold' },
  { value: 'gifted', label: 'Gave away' },
  { value: 'lost', label: 'Lost' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'replaced', label: 'Replaced' },
  { value: 'outgrown', label: 'Outgrown / no fit' },
  { value: 'unworn', label: 'Just don’t wear' },
  { value: 'other', label: 'Other' },
]

/** Modal for archiving an item with an optional reason + note. */
export function ArchiveDialog({
  open,
  onClose,
  onConfirm,
  itemName,
  busy,
}: Props) {
  const [reason, setReason] = useState<ArchivedReason | undefined>()
  const [note, setNote] = useState('')

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center bg-ink-950/80 backdrop-blur p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        className="bg-ink-900 border border-ink-800 rounded-2xl p-5 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">Archive item</h3>
        <p className="mt-1 text-sm text-ink-400">
          {itemName ? (
            <>
              Move <span className="text-ink-100">{itemName}</span> out of your
              active closet. You can restore it any time.
            </>
          ) : (
            <>
              Move it out of your active closet. You can restore it any time.
            </>
          )}
        </p>

        <div className="mt-4">
          <div className="text-xs text-ink-400 mb-2">
            Why are you archiving it? <span className="text-ink-500">(optional)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() =>
                  setReason((prev) => (prev === r.value ? undefined : r.value))
                }
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs border transition',
                  reason === r.value
                    ? 'bg-accent text-ink-950 border-accent'
                    : 'bg-ink-800 text-ink-300 border-ink-700 hover:text-ink-50',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs text-ink-400 mb-1">
            Note <span className="text-ink-500">(optional)</span>
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Gave to Rohan"
            className="form-input"
          />
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="px-4 py-2 rounded-full text-sm text-ink-300 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm(reason, note)}
            className="px-4 py-2 rounded-full bg-accent text-ink-950 text-sm font-medium disabled:opacity-50"
          >
            {busy ? 'Archiving…' : 'Archive'}
          </button>
        </div>
      </div>
    </div>
  )
}
