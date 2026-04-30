import { useEffect, useState } from 'react'
import { Sheet } from './Sheet'
import { relativeDayLabel, shortDate } from '@/lib/dates'

interface Props {
  /** When non-null the sheet is open and editing the note for this day. */
  dayMs: number | null
  /** Initial note text — pre-filled for editing. */
  initialNote?: string
  onClose: () => void
  onSave: (note: string) => void
}

/**
 * Tiny editor for a per-day diary note. Empty/whitespace input on save
 * deletes the note (handled in setDayNote). Keeps the textarea generously
 * sized so a multi-line memory ("wore this to Sneha's wedding, danced till 2")
 * lives comfortably.
 */
export function DayNoteSheet({
  dayMs,
  initialNote,
  onClose,
  onSave,
}: Props) {
  const [draft, setDraft] = useState('')

  // Re-prime the textarea each time the sheet opens for a new day.
  useEffect(() => {
    if (dayMs != null) setDraft(initialNote ?? '')
  }, [dayMs, initialNote])

  const open = dayMs != null
  const hadNote = (initialNote?.trim().length ?? 0) > 0
  const trimmed = draft.trim()
  // "Save" stays enabled even when blank — that's how you delete an existing
  // note. For a brand-new day, blank-save is a no-op so we disable.
  const canSubmit = hadNote || trimmed.length > 0

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={dayMs != null ? `Note · ${relativeDayLabel(dayMs)}` : 'Note'}
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] text-tertiary tabular-nums">
            {dayMs != null && shortDate(dayMs)}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-full text-sm text-ink-300"
            >
              Cancel
            </button>
            <button
              disabled={!canSubmit}
              onClick={() => onSave(draft)}
              className="px-4 py-2 rounded-full bg-accent text-ink-950 text-sm font-medium disabled:opacity-40"
            >
              {hadNote && trimmed.length === 0 ? 'Delete' : 'Save'}
            </button>
          </div>
        </div>
      }
    >
      <div className="px-4 py-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Wore this to Sneha's wedding…"
          rows={6}
          maxLength={500}
          autoFocus
          className="form-input resize-none"
        />
        <div className="mt-2 text-[11px] text-tertiary tabular-nums text-right">
          {draft.length}/500
        </div>
      </div>
    </Sheet>
  )
}
