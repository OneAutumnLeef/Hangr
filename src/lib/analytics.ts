import { db, type Item, type Wear } from '@/db/dexie'
import { addDays, daysBetween, startOfDay } from '@/lib/dates'

/**
 * Analytics layer — pure-ish functions that read all items + all wears in
 * a single pass and return everything the Insights screen needs.
 *
 * For personal-scale wardrobes (a few hundred items, a few thousand wears)
 * this is fine to recompute on every change. If we ever ship to power users
 * with much larger histories we can memoize per-day or shift to incremental.
 *
 * `wearCount` and friends always include the item's `seedWearCount` (the
 * pre-Hangr baseline a user enters when adding an item they've already
 * been wearing). This way "Most worn" reflects reality, not just tracked time.
 */

export interface ClosetStats {
  totalItems: number
  totalArchived: number
  totalSpentMinor: number
  /** Total of (logged wears) + (sum of seedWearCount across active items). */
  totalWears: number
  avgCostPerWear?: number
  itemsNeverWorn: number
  itemsDormant30: number
  itemsDormant90: number
  /** Sum of cost-per-wear-eligible items only (have price + at least 1 wear). */
  pricedSpentMinor: number
}

export interface ItemAnalytic {
  item: Item
  /** Logged wears + seedWearCount. */
  wearCount: number
  /** Logged wears only. */
  realWearCount: number
  /** Pre-Hangr seed (mirror of item.seedWearCount, or 0). */
  seedWearCount: number
  /**
   * Most recent observed wear timestamp. Logged wears beat seed; if no logged
   * wear, falls back to `seedAsOf`.
   */
  lastWornAt?: number
  daysSinceLastWear?: number
  /** Whole rupees per total wear. Uses combined wearCount. */
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
  dormantPairs: DormantPair[]
}

/**
 * A pair of items the user used to wear together but hasn't recently.
 * Co-occurrence is defined as "logged the same day" (matches the Wear
 * grouping). We surface the strongest forgotten pairs — high historical
 * count, large days-since-last-pairing.
 */
export interface DormantPair {
  itemA: Item
  itemB: Item
  /** How many distinct days they were worn together. */
  togetherCount: number
  lastSharedAt: number
  daysSinceLastShared: number
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
    const realLastWornAt = sorted[0]?.wornAt
    // For pre-owned items, seedAsOf acts as the last-known-touch when there
    // are no logged wears yet — otherwise a freshly added pre-owned item would
    // immediately look "dormant 2 years."
    const lastWornAt = realLastWornAt ?? item.seedAsOf
    const seed = item.seedWearCount ?? 0
    const totalWearCount = wears.length + seed
    return {
      item,
      wearCount: totalWearCount,
      realWearCount: wears.length,
      seedWearCount: seed,
      lastWornAt,
      daysSinceLastWear:
        lastWornAt != null ? daysBetween(lastWornAt, today) : undefined,
      costPerWear:
        item.purchasePriceMinor != null && totalWearCount > 0
          ? item.purchasePriceMinor / 100 / totalWearCount
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
  const totalWearsAll = items.reduce((s, i) => s + i.wearCount, 0)
  const avgCpw =
    totalWearsAll > 0 && pricedSpent > 0
      ? pricedSpent / 100 / totalWearsAll
      : undefined

  const stats: ClosetStats = {
    totalItems: items.length,
    totalArchived: allItems.length - activeItems.length,
    totalSpentMinor: totalSpent,
    totalWears: totalWearsAll,
    avgCostPerWear: avgCpw,
    itemsNeverWorn: items.filter((i) => i.wearCount === 0).length,
    itemsDormant30: items.filter(
      (i) => i.wearCount === 0 || (i.daysSinceLastWear ?? 0) >= 30,
    ).length,
    itemsDormant90: items.filter(
      (i) => i.wearCount === 0 || (i.daysSinceLastWear ?? 0) >= 90,
    ).length,
    pricedSpentMinor: pricedSpent,
  }

  // Weekly wear counts for the last 12 weeks (Monday-anchored).
  // Note: this only tracks LOGGED wears — seed wears aren't on the timeline.
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

  // Forgotten pairs — items co-worn historically but not recently
  const dormantPairs = computeDormantPairs(
    allWears,
    activeItems,
    today,
    /* minTogetherCount */ 3,
    /* minDormantDays */ 60,
  )

  return { stats, items, weeklyWearCounts, byCategory, dormantPairs }
}

function computeDormantPairs(
  wears: Wear[],
  activeItems: Item[],
  today: number,
  minTogetherCount: number,
  minDormantDays: number,
): DormantPair[] {
  // Bucket wears by day. Same-day items form an outfit-instance.
  const byDay = new Map<number, Set<string>>()
  for (const w of wears) {
    const set = byDay.get(w.wornAt) ?? new Set<string>()
    set.add(w.itemId)
    byDay.set(w.wornAt, set)
  }

  // Walk every same-day pair, tally togetherness + most-recent shared day.
  const pairKey = (a: string, b: string) =>
    a < b ? `${a}|${b}` : `${b}|${a}`
  const pairs = new Map<string, { count: number; lastShared: number }>()
  for (const [day, ids] of byDay) {
    const unique = Array.from(ids)
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const key = pairKey(unique[i], unique[j])
        const cur = pairs.get(key) ?? { count: 0, lastShared: 0 }
        cur.count += 1
        if (day > cur.lastShared) cur.lastShared = day
        pairs.set(key, cur)
      }
    }
  }

  const itemById = new Map(activeItems.map((it) => [it.id, it]))
  const out: DormantPair[] = []
  for (const [key, { count, lastShared }] of pairs) {
    if (count < minTogetherCount) continue
    const days = daysBetween(lastShared, today)
    if (days < minDormantDays) continue
    const [aId, bId] = key.split('|')
    const itemA = itemById.get(aId)
    const itemB = itemById.get(bId)
    // Skip pairs where either side has been archived — there's no actionable
    // "wear them again" if one is gone.
    if (!itemA || !itemB) continue
    out.push({
      itemA,
      itemB,
      togetherCount: count,
      lastSharedAt: lastShared,
      daysSinceLastShared: days,
    })
  }
  // Sort by togetherness desc, then by most-stale first
  return out.sort((x, y) => {
    if (y.togetherCount !== x.togetherCount)
      return y.togetherCount - x.togetherCount
    return y.daysSinceLastShared - x.daysSinceLastShared
  })
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
      (i) => i.wearCount === 0 || (i.daysSinceLastWear ?? 0) >= minDays,
    )
    .sort((a, b) => {
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

/**
 * Buyer's regret — items purchased in the last `daysWindow` days that haven't
 * been worn yet (no logged wears, no seed wears). Sorted newest-purchase first.
 *
 * Pure pain on demand: the things you spent money on, recently, that haven't
 * earned a single wear. Items without `purchasedAt` are skipped — "no date
 * set" usually means "imported from the past" rather than "fresh buy."
 */
export function buyersRegret(
  items: ItemAnalytic[],
  daysWindow = 90,
): ItemAnalytic[] {
  const today = startOfDay()
  return items
    .filter((a) => {
      if (a.wearCount > 0) return false
      const at = a.item.purchasedAt
      if (at == null) return false
      const days = daysBetween(at, today)
      return days >= 0 && days <= daysWindow
    })
    .sort(
      (a, b) => (b.item.purchasedAt ?? 0) - (a.item.purchasedAt ?? 0),
    )
}

/**
 * Top worn colours, weighted by total wears (logged + seed). Useful as a
 * "what you actually reach for" mirror — owned-vs-worn divergence is the
 * honest signal.
 */
export interface ColorBucket {
  /** Original case, taken from the most-worn item with that lowercased key. */
  name: string
  /** Number of distinct items this color contributes. */
  itemCount: number
  /** Sum of wears across those items. */
  wearCount: number
}

export function topWornColors(
  items: ItemAnalytic[],
  n = 5,
): ColorBucket[] {
  const byKey = new Map<
    string,
    { displayName: string; itemCount: number; wearCount: number }
  >()
  for (const a of items) {
    const raw = a.item.color?.trim()
    if (!raw) continue
    const key = raw.toLowerCase()
    const cur = byKey.get(key) ?? {
      displayName: raw,
      itemCount: 0,
      wearCount: 0,
    }
    cur.itemCount += 1
    cur.wearCount += a.wearCount
    byKey.set(key, cur)
  }
  return Array.from(byKey.values())
    .filter((c) => c.wearCount > 0)
    .sort((a, b) => b.wearCount - a.wearCount)
    .slice(0, n)
    .map((c) => ({
      name: c.displayName,
      itemCount: c.itemCount,
      wearCount: c.wearCount,
    }))
}

export function formatRupees(minor: number): string {
  return `₹${(minor / 100).toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })}`
}

/**
 * Inventory cross-check for the Want list. Given a category, return how many
 * active items the user already owns in it, total spent, average ₹/wear,
 * and how many of those have gone unworn 60+ days. The signal we want to
 * surface before a purchase: "you already own 4 of these, two are dormant."
 */
export interface InventorySnapshot {
  category: string
  itemCount: number
  spentMinor: number
  /** Mean ₹/wear across items with both price and at least one wear. */
  avgCostPerWear?: number
  /** How many of those items are dormant 60+ days (or never worn). */
  dormantCount: number
}

export function inventoryForCategory(
  items: ItemAnalytic[],
  category: string,
): InventorySnapshot {
  const matching = items.filter((a) => a.item.category === category)
  const itemCount = matching.length
  const spentMinor = matching.reduce(
    (s, a) => s + (a.item.purchasePriceMinor ?? 0),
    0,
  )
  const cpwEligible = matching.filter(
    (a) => a.costPerWear != null && Number.isFinite(a.costPerWear),
  )
  const avgCostPerWear =
    cpwEligible.length > 0
      ? cpwEligible.reduce((s, a) => s + (a.costPerWear ?? 0), 0) /
        cpwEligible.length
      : undefined
  const dormantCount = matching.filter(
    (a) => a.wearCount === 0 || (a.daysSinceLastWear ?? 0) >= 60,
  ).length
  return { category, itemCount, spentMinor, avgCostPerWear, dormantCount }
}
