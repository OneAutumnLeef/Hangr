/**
 * "Year in clothes" — a single shareable PNG summarizing the year. Renders
 * client-side on a 1080×1920 canvas (IG story aspect) so it stays
 * privacy-respecting; nothing leaves the device unless the user shares it.
 *
 * Stats include the most-worn item (with its photo if available), top colour,
 * total wears, items added, average ₹/wear, and dormant count. We compute by
 * filtering wears to `[year, year+1)` so the recap is locked to a single year.
 */

import { db } from '@/db/dexie'
import { colorNameToHex } from './colors'

export interface WrappedStats {
  year: number
  totalWears: number
  itemsAdded: number
  dormantCount: number
  avgCostPerWear?: number
  mostWornItem?: {
    id: string
    name: string
    wearCount: number
    photoBlob?: Blob
  }
  topColor?: {
    name: string
    wearCount: number
    hex: string
  }
}

export async function computeWrapped(year: number): Promise<WrappedStats> {
  const yearStart = new Date(year, 0, 1).getTime()
  const yearEnd = new Date(year + 1, 0, 1).getTime()

  const [items, wears] = await Promise.all([
    db.items.toArray(),
    db.wears.where('wornAt').between(yearStart, yearEnd, true, false).toArray(),
  ])

  const itemMap = new Map(items.map((i) => [i.id, i]))

  const wearsByItem = new Map<string, number>()
  for (const w of wears) {
    wearsByItem.set(w.itemId, (wearsByItem.get(w.itemId) ?? 0) + 1)
  }

  // Most-worn this year
  let topId: string | null = null
  let topCount = 0
  for (const [id, count] of wearsByItem) {
    if (count > topCount) {
      topCount = count
      topId = id
    }
  }
  let mostWornItem: WrappedStats['mostWornItem']
  if (topId) {
    const item = itemMap.get(topId)
    if (item) {
      const photo = item.primaryPhotoId
        ? await db.itemPhotos.get(item.primaryPhotoId)
        : undefined
      mostWornItem = {
        id: item.id,
        name: item.name,
        wearCount: topCount,
        photoBlob: photo?.blob,
      }
    }
  }

  // Top colour weighted by wears
  const colorCounts = new Map<string, { display: string; count: number }>()
  for (const w of wears) {
    const item = itemMap.get(w.itemId)
    if (!item?.color) continue
    const key = item.color.toLowerCase()
    const cur = colorCounts.get(key) ?? { display: item.color, count: 0 }
    cur.count += 1
    colorCounts.set(key, cur)
  }
  let topColor: WrappedStats['topColor']
  if (colorCounts.size > 0) {
    const sorted = Array.from(colorCounts.values()).sort(
      (a, b) => b.count - a.count,
    )
    const top = sorted[0]
    topColor = {
      name: top.display,
      wearCount: top.count,
      hex: colorNameToHex(top.display),
    }
  }

  // Avg ₹/wear scoped to this year's wears, only items with both price + wears
  let pricedSpent = 0
  let pricedWears = 0
  for (const [id, count] of wearsByItem) {
    const item = itemMap.get(id)
    if (item?.purchasePriceMinor != null) {
      pricedSpent += item.purchasePriceMinor
      pricedWears += count
    }
  }
  const avgCostPerWear =
    pricedWears > 0 ? pricedSpent / 100 / pricedWears : undefined

  const itemsAdded = items.filter(
    (i) => i.createdAt >= yearStart && i.createdAt < yearEnd,
  ).length

  // Dormant: active items with zero wears in this year
  const dormantCount = items.filter(
    (i) => !i.archivedAt && !wearsByItem.has(i.id),
  ).length

  return {
    year,
    totalWears: wears.length,
    itemsAdded,
    dormantCount,
    avgCostPerWear,
    mostWornItem,
    topColor,
  }
}

/* ─── Canvas rendering ──────────────────────────────────────────────────── */

const W = 1080
const H = 1920

const COLORS = {
  bg: '#050505',
  surface1: '#0E0E0F',
  hairline: '#26262A',
  primary: '#F5F5F4',
  secondary: '#A1A1A1',
  tertiary: '#6B6B6B',
  accent: '#A3E635',
}

export async function renderWrappedPng(stats: WrappedStats): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  // Make sure custom fonts are ready before drawing — otherwise canvas falls
  // back to system fonts and the result looks generic.
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready
    } catch {
      /* non-fatal */
    }
  }

  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, W, H)

  const PAD = 80

  // ─── Title ────────────────────────────────────────────────────────────
  ctx.textAlign = 'left'
  ctx.fillStyle = COLORS.tertiary
  ctx.font = '600 32px Inter, system-ui, sans-serif'
  ctx.fillText('YOUR YEAR IN CLOTHES', PAD, 200)

  ctx.fillStyle = COLORS.primary
  ctx.font = 'italic 600 192px Fraunces, Georgia, serif'
  ctx.fillText(`${stats.year}`, PAD, 380)

  ctx.fillStyle = COLORS.accent
  ctx.font = '500 60px Fraunces, Georgia, serif'
  ctx.fillText('Honestly.', PAD, 460)

  // ─── Most-worn item with photo ────────────────────────────────────────
  let cursorY = 600

  if (stats.mostWornItem) {
    cursorY = await drawMostWorn(ctx, stats.mostWornItem, cursorY)
  }

  // ─── Stat grid 2×2 ────────────────────────────────────────────────────
  const gridY = Math.min(cursorY + 40, 1300)
  drawStatGrid(ctx, stats, PAD, gridY)

  // ─── Top colour ──────────────────────────────────────────────────────
  if (stats.topColor) {
    drawTopColour(ctx, stats.topColor, PAD, gridY + 360)
  }

  // ─── Footer ──────────────────────────────────────────────────────────
  ctx.textAlign = 'center'
  ctx.fillStyle = COLORS.tertiary
  ctx.font = '500 28px Inter, system-ui, sans-serif'
  ctx.fillText('hangr · your wardrobe, honestly', W / 2, H - 80)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      'image/png',
    )
  })
}

async function drawMostWorn(
  ctx: CanvasRenderingContext2D,
  most: NonNullable<WrappedStats['mostWornItem']>,
  startY: number,
): Promise<number> {
  const PAD = 80
  const photoSize = 360

  // Photo on the left, info on the right
  if (most.photoBlob) {
    try {
      const url = URL.createObjectURL(most.photoBlob)
      const img = await loadImage(url).finally(() => URL.revokeObjectURL(url))

      // Card frame
      ctx.fillStyle = COLORS.surface1
      ctx.strokeStyle = COLORS.hairline
      ctx.lineWidth = 2
      roundRect(ctx, PAD, startY, photoSize, photoSize, 24)
      ctx.fill()
      ctx.stroke()

      // Fit-contain the image inside the card
      const ratio = Math.min(
        (photoSize - 32) / img.width,
        (photoSize - 32) / img.height,
      )
      const drawW = img.width * ratio
      const drawH = img.height * ratio
      ctx.drawImage(
        img,
        PAD + (photoSize - drawW) / 2,
        startY + (photoSize - drawH) / 2,
        drawW,
        drawH,
      )
    } catch (err) {
      console.warn('Wrapped: failed to draw photo', err)
    }
  }

  const textX = PAD + photoSize + 40
  let y = startY + 60

  ctx.textAlign = 'left'
  ctx.fillStyle = COLORS.tertiary
  ctx.font = '600 28px Inter, system-ui, sans-serif'
  ctx.fillText('MOST WORN', textX, y)
  y += 60

  ctx.fillStyle = COLORS.primary
  ctx.font = 'italic 500 56px Fraunces, Georgia, serif'
  // Wrap to 2 lines if name is long
  wrapText(ctx, most.name, y, W - textX - PAD, 64).forEach(({ line, ny }) => {
    ctx.fillText(line, textX, ny)
    y = ny
  })
  y += 80

  ctx.fillStyle = COLORS.accent
  ctx.font = '600 80px Inter, system-ui, sans-serif'
  ctx.fillText(`${most.wearCount}`, textX, y)
  ctx.fillStyle = COLORS.secondary
  ctx.font = '500 36px Inter, system-ui, sans-serif'
  ctx.fillText(
    most.wearCount === 1 ? ' time' : ' times',
    textX +
      ctx.measureText(`${most.wearCount}`).width +
      8 -
      ctx.measureText(`${most.wearCount}`).actualBoundingBoxLeft,
    y,
  )

  return startY + photoSize
}

function drawStatGrid(
  ctx: CanvasRenderingContext2D,
  stats: WrappedStats,
  pad: number,
  y: number,
) {
  const cellW = (W - pad * 2 - 24) / 2
  const cellH = 160

  drawStatCell(ctx, pad, y, cellW, cellH, 'WEARS', `${stats.totalWears}`)
  drawStatCell(
    ctx,
    pad + cellW + 24,
    y,
    cellW,
    cellH,
    'AVG ₹/WEAR',
    stats.avgCostPerWear != null
      ? `₹${Math.round(stats.avgCostPerWear).toLocaleString('en-IN')}`
      : '—',
  )
  drawStatCell(
    ctx,
    pad,
    y + cellH + 24,
    cellW,
    cellH,
    'ADDED',
    `${stats.itemsAdded}`,
  )
  drawStatCell(
    ctx,
    pad + cellW + 24,
    y + cellH + 24,
    cellW,
    cellH,
    'DORMANT',
    `${stats.dormantCount}`,
    stats.dormantCount > 0 ? COLORS.accent : COLORS.primary,
  )
}

function drawStatCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  valueColor = COLORS.primary,
) {
  ctx.fillStyle = COLORS.surface1
  ctx.strokeStyle = COLORS.hairline
  ctx.lineWidth = 2
  roundRect(ctx, x, y, w, h, 20)
  ctx.fill()
  ctx.stroke()

  ctx.textAlign = 'left'
  ctx.fillStyle = COLORS.tertiary
  ctx.font = '600 22px Inter, system-ui, sans-serif'
  ctx.fillText(label, x + 28, y + 50)

  ctx.fillStyle = valueColor
  ctx.font = '600 76px Inter, system-ui, sans-serif'
  ctx.fillText(value, x + 28, y + h - 32)
}

function drawTopColour(
  ctx: CanvasRenderingContext2D,
  topColor: NonNullable<WrappedStats['topColor']>,
  pad: number,
  y: number,
) {
  ctx.textAlign = 'left'
  ctx.fillStyle = COLORS.tertiary
  ctx.font = '600 28px Inter, system-ui, sans-serif'
  ctx.fillText('TOP COLOUR', pad, y)

  // Swatch
  const swatchSize = 72
  ctx.fillStyle = topColor.hex
  ctx.beginPath()
  ctx.arc(pad + swatchSize / 2, y + 60 + swatchSize / 2, swatchSize / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = COLORS.hairline
  ctx.lineWidth = 2
  ctx.stroke()

  // Name + count
  const textX = pad + swatchSize + 24
  ctx.fillStyle = COLORS.primary
  ctx.font = '500 56px Fraunces, Georgia, serif'
  ctx.fillText(topColor.name, textX, y + 110)

  ctx.fillStyle = COLORS.secondary
  ctx.font = '500 28px Inter, system-ui, sans-serif'
  ctx.fillText(
    `${topColor.wearCount} ${topColor.wearCount === 1 ? 'wear' : 'wears'}`,
    textX,
    y + 150,
  )
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = src
  })
}

/** Cap text to 2 lines, breaking on word boundaries. Returns the lines + Y
 *  positions for caller to render. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 2,
): { line: string; ny: number }[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word
    if (ctx.measureText(trial).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = trial
    }
    if (lines.length >= maxLines - 1) break
  }
  if (current) lines.push(current)
  // Truncate the final line with an ellipsis if it still overflows.
  if (lines.length === maxLines) {
    while (
      ctx.measureText(`${lines[lines.length - 1]}…`).width > maxWidth &&
      lines[lines.length - 1].length > 0
    ) {
      lines[lines.length - 1] = lines[lines.length - 1].slice(0, -1)
    }
    if (words.length > lines.flatMap((l) => l.split(/\s+/)).length) {
      lines[lines.length - 1] += '…'
    }
  }
  return lines.map((line, i) => ({ line, ny: y + i * lineHeight }))
}
