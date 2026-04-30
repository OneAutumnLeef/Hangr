import { db, type DayNote } from './dexie'

/**
 * Per-day diary notes. One note per `dayMs` (start-of-day in local TZ),
 * ad-hoc text — "wore this to Sneha's wedding," "first day of new job," etc.
 *
 * Notes are independent of wears, so deleting all wears for a day doesn't
 * lose the note, and the user only maintains a single text blob per day
 * regardless of how many items they logged.
 */

export async function getDayNote(dayMs: number): Promise<DayNote | undefined> {
  return db.dayNotes.get(dayMs)
}

/**
 * Set or replace the note for `dayMs`. Empty / whitespace-only strings clear
 * the note (delete the row) so we don't end up with stub rows after edits.
 */
export async function setDayNote(dayMs: number, note: string): Promise<void> {
  const trimmed = note.trim()
  if (!trimmed) {
    await db.dayNotes.delete(dayMs)
    return
  }
  await db.dayNotes.put({
    dayMs,
    note: trimmed,
    updatedAt: Date.now(),
  })
}

export async function deleteDayNote(dayMs: number): Promise<void> {
  await db.dayNotes.delete(dayMs)
}

/**
 * Bulk-load notes for a list of days. Used when rendering the recent-days
 * list — one round trip instead of N.
 */
export async function listDayNotes(
  dayMsList: number[],
): Promise<Map<number, string>> {
  if (dayMsList.length === 0) return new Map()
  const rows = await db.dayNotes.where('dayMs').anyOf(dayMsList).toArray()
  return new Map(rows.map((r) => [r.dayMs, r.note]))
}
