import { db, type Item, type Wear } from '@/db/dexie'
import { addDays, daysBetween, startOfDay } from '@/lib/dates'

/**
 * Analytics layer — pure-ish functions that read all items + all wears in
 * a single pass and return everything the Insights screen needs.
 *
 * For personal-scale wardrobes (a few hundred items, a few thousand wears)
 * this is fine to recompute on every change. If we ever ship to power users
 * with much larger histories we can memoize per-day or shift to incremental.
 */

export interface ClosetStats {
  totalItems: number
  totalArchived: number
  totalSpentMinor: number
  totalWears: number
  avgCostPerWear?: number
  itemsNeverWorn: number
  itemsDormant30: number
  itemsDormant90: number
  /** Sum of cost-per-wear-eligible items only (i.e., have price + at least 1 wear). */
  pricedSpentMinor: number
}

export interface ItemAnalytic {
  item: Item
  wearCount: number
  lastWornAt?: number
  daysSinceLastWear?: number
  /** In whole rupees. */
  costPerWear?: number
}

export interface WeeklyBucket {
  weekStart: number
  count: number
  label: string
}

export interface AnalyticsBundle {
  stats: ClosetStats
  items: ItemAnalytic[]
  weeklyWearCounts: WeeklyBucket[]
  byCategory: { category: string; count: number; spentMinor: number }[]
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export async function loadAllAnalytics(): Promise<AnalyticsBundle> {
  const [allItems, allWears] = await Promise.all([
    db.items.toArray(),
    db.wears.toArray(),
  ])

  const wearsByItem = new Map<string, Wear[]>()
  for (const w of allWears) {
    const arr = wearsByItem.get(w.itemId) ?? []
    arr.push(w)
    wearsByItem.set(w.itemId, arr)
  }

  const today = startOfDay()
  const activeItems = allItems.filter((i) => !i.archivedAt)

  const items: ItemAnalytic[] = activeItems.map((item) => {
    const wears = wearsByItem.get(item.id) ?? []
    const sorted = [...wears].sort((a, b) => b.wornAt - a.wornAt)
    const lastWornAt = sorted[0]?.wornAt
    return {
      item,
      wearCount: wears.length,
      lastWornAt,
      daysSinceLastWear:
        lastWornAt != null ? daysBetween(lastWornAt, today) : undefined,
      costPerWear:
        item.purchasePriceMinor != null && wears.length > 0
          ? item.purchasePriceMinor / 100 / wears.length
          : undefined,
    }
  })

  const totalSpent = items.reduce(
    (sum, i) => sum + (i.item.purchasePriceMinor ?? 0),
    0,
  )
  const pricedSpent = items.reduce(
    (sum, i) =>
      i.wearCount > 0 && i.item.purchasePriceMinor != null
        ? sum + i.item.purchasePriceMinor
        : sum,
    0,
  )
  const totalWears = allWears.length
  const avgCpw =
    totalWears > 0 && pricedSpent > 0 ? pricedSpent / 100 / totalWears : undefined

  const stats: ClosetStats = {
    totalItems: items.length,
    totalArchived: allItems.length - activeItems.length,
    totalSpentMinor: totalSpent,
    totalWears,
    avgCostPerWear: avgCpw,
    itemsNeverWorn: items.filter((i) => i.wearCount === 0).length,
    itemsDormant30: items.filter(
      (i) =>
        i.wearCount === 0 || (i.daysSinceLastWear ?? 0) >= 30,
    ).length,
    itemsDormant90: items.filter(
      (i) =>
        i.wearCount === 0 || (i.daysSinceLastWear ?? 0) >= 90,
    ).length,
    pricedSpentMinor: pricedSpent,
  }

  // Weekly wear counts for the last 12 weeks (Monday-anchored).
  const todayDate = new Date(today)
  const jsDow = todayDate.getDay() // 0 (Sun) .. 6 (Sat)
  const dayOfWeek = jsDow === 0 ? 6 : jsDow - 1 // 0 = Monday
  const thisMonday = startOfDay(addDays(today, -dayOfWeek))

  const weeklyWearCounts: WeeklyBucket[] = []
  for (let i = 11; i >= 0; i--) {
    const weekStart = thisMonday - i * WEEK_MS
    const weekEnd = weekStart + WEEK_MS
    const count = allWears.filter(
      (w) => w.wornAt >= weekStart && w.wornAt < weekEnd,
    ).length
    const label = new Date(weekStart).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    })
    weeklyWearCounts.push({ weekStart, count, label })
  }

  // By-category breakdown (active items only)
  const catMap = new Map<string, { count: number; spentMinor: number }>()
  for (const a of items) {
    const c = a.item.category ?? 'Uncategorized'
    const cur = catMap.get(c) ?? { count: 0, spentMinor: 0 }
    cur.count += 1
    cur.spentMinor += a.item.purchasePriceMinor ?? 0
    catMap.set(c, cur)
  }
  const byCategory = Array.from(catMap.entries())
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.count - a.count)

  return { stats, items, weeklyWearCounts, byCategory }
}

// ─── Convenience selectors ──────────────────────────────────────────────────

export function bestCostPerWear(items: ItemAnalytic[], n = 5) {
  return items
    .filter((i) => i.costPerWear != null)
    .sort((a, b) => (a.costPerWear ?? 0) - (b.costPerWear ?? 0))
    .slice(0, n)
}

export function worstCostPerWear(items: ItemAnalytic[], n = 5) {
  return items
    .filter((i) => i.costPerWear != null)
    .sort((a, b) => (b.costPerWear ?? 0) - (a.costPerWear ?? 0))
    .slice(0, n)
}

export function dormantItems(items: ItemAnalytic[], minDays = 30) {
  return items
    .filter(
      (i) =>
        i.wearCount === 0 || (i.daysSinceLastWear ?? 0) >= minDays,
    )
    .sort((a, b) => {
      // Never-worn first, then longest-dormant
      if (a.wearCount === 0 && b.wearCount !== 0) return -1
      if (b.wearCount === 0 && a.wearCount !== 0) return 1
      const aD = a.daysSinceLastWear ?? Infinity
      const bD = b.daysSinceLastWear ?? Infinity
      return bD - aD
    })
}

export function mostWorn(items: ItemAnalytic[], n = 5) {
  return items
    .filter((i) => i.wearCount > 0)
    .sort((a, b) => b.wearCount - a.wearCount)
    .slice(0, n)
}

export function formatRupees(minor: number): string {
  return `₹${(minor / 100).toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })}`
}
