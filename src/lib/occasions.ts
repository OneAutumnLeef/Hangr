/**
 * Canonical occasion tags. Items can carry several. Indian festive context
 * is intentionally broad here — "Festive" covers Diwali / Holi / Eid /
 * pooja-style wear; "Wedding" gets its own slot because functions warrant
 * different planning. Add narrower tags only if a real signal demands it.
 */

export const OCCASIONS = [
  'Casual',
  'Office',
  'Formal',
  'Festive',
  'Wedding',
  'Travel',
  'Sport',
  'Lounge',
] as const

export type Occasion = (typeof OCCASIONS)[number]

export function isOccasion(value: string): value is Occasion {
  return (OCCASIONS as readonly string[]).includes(value)
}
