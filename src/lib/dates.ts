/**
 * Date helpers — wears live in IndexedDB as unix-ms timestamps representing
 * the START OF DAY in the user's local timezone. That way "I wore this Tuesday"
 * is unambiguous regardless of when the user logged it.
 */

export function startOfDay(date: Date | number = new Date()): number {
  const d = typeof date === 'number' ? new Date(date) : new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function endOfDay(date: Date | number = new Date()): number {
  const d = typeof date === 'number' ? new Date(date) : new Date(date)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

export function addDays(date: Date | number, n: number): number {
  const d = typeof date === 'number' ? new Date(date) : new Date(date)
  d.setDate(d.getDate() + n)
  return d.getTime()
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b)
}

export function daysBetween(a: number, b: number): number {
  return Math.round((startOfDay(b) - startOfDay(a)) / (1000 * 60 * 60 * 24))
}

const today = () => startOfDay()

export function relativeDayLabel(ts: number): string {
  const diff = daysBetween(today(), ts)
  if (diff === 0) return 'Today'
  if (diff === -1) return 'Yesterday'
  if (diff === 1) return 'Tomorrow'
  if (diff < 0 && diff > -7) {
    return new Date(ts).toLocaleDateString('en-IN', { weekday: 'long' })
  }
  return new Date(ts).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function shortDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  })
}
