/**
 * TEMP — demo seed data for the design refresh preview.
 *
 * This file (and the "Add example data" row in Settings.tsx that uses it) is
 * dev-only. Delete both when you're done evaluating the new UI.
 *
 * Adds ~15 items with real garment photos pulled from Stitch's public CDN
 * (the same images that appear in the design mockups), plus 90 days of
 * distributed wears and 2 saved outfits. Additive to whatever's already in
 * the closet.
 */

import { db } from '@/db/dexie'
import { createItem } from '@/db/items'
import { logWear } from '@/db/wears'
import { createOutfit } from '@/db/outfits'
import { startOfDay, addDays } from '@/lib/dates'

interface SeedItem {
  name: string
  category: string
  color: string
  brand?: string
  priceRupees?: number
  monthsAgo?: number
  /** Pre-Hangr baseline wears, counted toward stats. */
  seedWears?: number
  /** Number of recent (post-Hangr) wears to log over the last 90 days. */
  recentWears: number
  /** How long ago the most recent wear was. Use Infinity for "never". */
  lastWornDaysAgo: number
  /** Color hex used by the canvas fallback if the photo URL fails. */
  hex: string
  /** Public Stitch CDN URL for the garment photo. */
  photoUrl: string
}

// All photos sourced from the Stitch design mockups (public, CORS-enabled).
const STITCH = (id: string) => `https://lh3.googleusercontent.com/aida-public/${id}`

const ITEMS: SeedItem[] = [
  // Most-worn workhorses
  {
    name: 'Sunspel Heavyweight Tee',
    category: 'Top',
    color: 'White',
    brand: 'Sunspel',
    priceRupees: 2999,
    monthsAgo: 11,
    recentWears: 38,
    lastWornDaysAgo: 1,
    hex: '#f5f5f4',
    photoUrl: STITCH(
      'AB6AXuD9hA6ufXkNvNyBQbXCBbkipLQpBkNSQm4z-Sys2WR2gRsyqRqjZDEFBdFvcliruOMFOv2YMbiMaTgxMx7UkT1fAKIcdU7JI5rURkSIaF7_6nniONaCqgC8IWXE8DZ28Hz7DydifO_C8l2bfZTxPFkakJgxLdttphLxzvkIfDqHyEK-w9V-HmmrfAYphkRANuWiFi-QB4KM348WEqi8FQXUcnGTkSHg5o98n4CHzYkByWEXpIJXu91Wc_tXDEmKyyL1jC7fLNM3GM9H',
    ),
  },
  {
    name: 'APC Petit Standard',
    category: 'Bottom',
    color: 'Indigo',
    brand: 'A.P.C.',
    priceRupees: 14500,
    monthsAgo: 22,
    seedWears: 30,
    recentWears: 28,
    lastWornDaysAgo: 2,
    hex: '#1a2e4a',
    photoUrl: STITCH(
      'AB6AXuDbt2JPNALhCXrR1g5Hs6ZFbFJC0CqeuSyX97K4X-IL6vCv4wqJiSNawkHyE_9qMr47jExSFvW_gTRY2OvwaL7dcXMVdvH1dT0i2lCytlNjRDHWp4iyjXQ-LVzErWfEvOM3fSL7Cx8xOznaLQ2D7oGlNnnVwTSVzQLZX9rwvT3l6-Lv_VNHAaFRoqeTkYxV1XM5T-O57IAjDe4l7qHXj5LgaS7grrHJ7vI3s06_E6t5OLhooX1dpQNevmlwtz7Ko4T56bbkPrrnbiaM',
    ),
  },
  {
    name: 'Casual Blue Tee',
    category: 'Top',
    color: 'Blue',
    brand: 'Uniqlo',
    priceRupees: 999,
    monthsAgo: 9,
    recentWears: 22,
    lastWornDaysAgo: 3,
    hex: '#2c5784',
    photoUrl: STITCH(
      'AB6AXuDKXoUTiL4V9s1b3j1b28nkycHo4CJSWlBsgAkbJFBK7ECkmNKBsgxCAEu_dRGJi-WIfcvKgToSR_1jjDQLt6SbdAOMNKK7-0MYDU9T_onlspT4i8mJlmA73k0wJ3qs6qU0J46DvIPShxQ9lQ1SK-Vo_Wd4lGqAM63GKySGsx4JqVqZRB5HNm5ervlDokCYavhhFi8Vwl-NKgYZZfApyTtRNQYD0ZE_sedK8ILzaKFtX4Viy2FH7CrpkMAasfLCvyl628TyXvFyKC0m',
    ),
  },
  {
    name: 'White Formal Shirt',
    category: 'Top',
    color: 'White',
    brand: 'Van Heusen',
    priceRupees: 2499,
    monthsAgo: 13,
    recentWears: 18,
    lastWornDaysAgo: 4,
    hex: '#fafaf9',
    photoUrl: STITCH(
      'AB6AXuBB-TYZkC8AY3dQ-Aeu-Y8gfstYOxj78ejGjsF3HIw2gxNe6F6Sl18tGj_yBDEGKJ7acsWcK3V74EKR4i-l1sFkFfQJFVYUZYgn9pVHNvYvF8E3z1TPWpgV4E18Szdr03wCEjl2bYqEDd1wwtBt2acHL2fQIAouyXnbDU7XgkDKMw6QzDlD_W2UZn9UXb8RKvL9bPJvUM-iMNV1OVJwZJs_MMmpqflCSkjS_mBnyiYWm-Tm--oZ1kk8C5F8PfzkWEm1GT0LW-7LhGlv',
    ),
  },
  {
    name: 'Dark Tailored Trousers',
    category: 'Bottom',
    color: 'Charcoal',
    brand: 'Tasva',
    priceRupees: 3499,
    monthsAgo: 10,
    recentWears: 16,
    lastWornDaysAgo: 5,
    hex: '#23262b',
    photoUrl: STITCH(
      'AB6AXuCixsTkqDFg9HUN531qlFWn3JTJZR7ZAHHgrmJvMevFIfdB0oqrrihoiIZ0XO2eMvW1eSk4rh8CVf6hxsB-8jomeA7HIxfb7vNMBFXWw9_Ur_QK00iiFf8znsxGzX1w0kH7cKYhxkIP9EgzGCnIGzXHxVYEauCkROCDI9Knui9aT8gIXtL9hTxpmNJBorrMmbIs3QlpJ_EOEJqNAZdP4PoypFDjUB5Fi20SvHYEmkMYSnEHTzaVtaLZpGTDvzHY2ZD8ok3SJpFD8wSN',
    ),
  },

  // Mid-tier ethnic wear
  {
    name: 'Beige Kurta',
    category: 'Ethnic',
    color: 'Beige',
    brand: 'Fabindia',
    priceRupees: 2999,
    monthsAgo: 8,
    recentWears: 12,
    lastWornDaysAgo: 7,
    hex: '#cdb992',
    photoUrl: STITCH(
      'AB6AXuBm69SL4DKinNXaZZy830ZaIdgEKcFKzipVQmblVrV425bq2dmSNU3mdYycXyem4FoS2qnnJskP0LA1ulP4OD5eftmsjD8TKBG1R23LKM_tLksHU5UDGzK8MDPRVIEsWwApDCN_JQjCmji9qYReG07XZmwd8QOFGR0oXI5_PGcs18pBwRyX1HFwbL_tKBY64l7kX2IXbC1kz8NoU6MrywQO1C9JTk9mWeXhJVgSxCID2-KVqnZDdO_LZwrt4UJPhe9aNMncu3EZQVvc',
    ),
  },
  {
    name: 'Navy Textured Kurta',
    category: 'Ethnic',
    color: 'Navy',
    brand: 'Manyavar',
    priceRupees: 2499,
    monthsAgo: 6,
    recentWears: 9,
    lastWornDaysAgo: 11,
    hex: '#1f2c4d',
    photoUrl: STITCH(
      'AB6AXuB2aTT5Is75f3jDzicc1WQuLRMqKYq_vteuoZ-4b2LcWBH8uhrj6no9hXuSDHMRFKViXoaI8QkcG5N65mSRun2dULb6znN_OYOaRUT17Ix-EO6yzJLKycRLfVNHuRcRIPEFVgtdgGVU9AX_wiptab9VIxvTEunC8xN5bsdhsXQVJmFuH407e8kIAtCVTHvvyywgcyzjt7Bt5kY_yq5ZbjrWJQTqtIpgln9sPMaVUt9SBYVIeWUgMqnRBI0vWVDd7Y3zOqrxTGx5H8GE',
    ),
  },
  {
    name: 'White Linen Shirt',
    category: 'Top',
    color: 'White',
    brand: 'COS',
    priceRupees: 4500,
    monthsAgo: 5,
    recentWears: 11,
    lastWornDaysAgo: 9,
    hex: '#ece6d5',
    photoUrl: STITCH(
      'AB6AXuBNq4XRRd1SJzc5kOO6BRY_XDRKTIgdt3mX4LezXtoK_HjIh1I6AANcS1zCmyNV1MVpG3IEI7kxOUkOM6ZWSYzyGTwpDEbsf66gceGGqFOvYoXoIp7blgsxBNL8NDLDfdnDf16OwDrL2-Rri9V8MEBCZ-7FT-2Nmb_4aY4Kbtpxr8vnPlaljWolC-Ndff7UrOMTnzWohcV5W7-McPvPCkHvUyTBBTE_EvyrH1yAS1HQ3Zi0HKhFK1CYB6ROn4YYjyMy1JnyKIPZji2C',
    ),
  },
  {
    name: 'Polished Brogues',
    category: 'Shoes',
    color: 'Brown',
    brand: 'Clarks',
    priceRupees: 5999,
    monthsAgo: 8,
    recentWears: 8,
    lastWornDaysAgo: 12,
    hex: '#5c3a1e',
    photoUrl: STITCH(
      'AB6AXuDfN1C371NomzbnxVCwMbRh7Vq4-hboZwt16w7VCrc-OqCLDUkiLpmcB25dfKdgRas8M2zrXAoFtFhmAi9iwMW5RDB0AoPfrc0B9Cqv3JwPsK--teBn2JjfQzrGhlU15C66V1IrmQumW7inHDxkd0zQgsp6U1W8JNVOctbCZIk5QpFnJBOZ1c2uoAy_QJ-fVCzB7EFd-i0-96hFcAitV8xrPRffnoLzJV2lLMbl_tolp2WdEgtgJ2if6ZrnsSQz1h2hOmkLBK7yjV_i',
    ),
  },
  {
    name: 'Leather Mojaris',
    category: 'Shoes',
    color: 'Tan',
    brand: 'Tipsyfly',
    priceRupees: 2499,
    monthsAgo: 14,
    recentWears: 6,
    lastWornDaysAgo: 18,
    hex: '#a37855',
    photoUrl: STITCH(
      'AB6AXuAcXtGqdevZUbsg4dFKRb-n5hBzdszzB81mIu10sQi14ifs1iPyLlO5BacGN1gBUiN1mX18KEvFcWLewovI6MoqGTpEPDHToBpaIoLu-3rB3h3YNP5kRka5_KsdXgtps8aj99TxmKDaYWcFeqNnSPvLlK6kogJ9cucdkvR75LLdOgeUnqBYfOjct9rgI2PQ7HvpijAnuVJSG2DwFLCGFWFBSE3lgiawNhEYYUBQjItjYFCxvo8PBRjAcWSVxOfsFtLTNq7_BwbS2Vtt',
    ),
  },
  {
    name: 'Embroidered Waistcoat',
    category: 'Ethnic',
    color: 'Earth',
    brand: 'Anita Dongre',
    priceRupees: 6500,
    monthsAgo: 7,
    recentWears: 4,
    lastWornDaysAgo: 22,
    hex: '#7a5430',
    photoUrl: STITCH(
      'AB6AXuBq88SYmvwUUQN9bRi3M3ACaSj4YVwCzGBdhjLM4BTU2upbkTq_NPhfYw2kbHVcy6aqDcvXgZqK9NODeORSJlUxIf3IfFfSeuSTepNCcgL5USozWuafURP83jcIHNYW8TlUad7LRNPvSzSb1_WWWfzhSZySf9rXUmZiBkIZxDaNlVLrJhXX-I7w4SyiSu2AKCiRxmuFvYpbKAc5It4skiirxDz2knEJ-yZTSifKxHyqLJArPqphrQbC7FEc3QxyB-dLQEkhoPXFS63B',
    ),
  },

  // High-CPW: expensive, rarely worn
  {
    name: 'Acne Studios Moto',
    category: 'Outerwear',
    color: 'Black',
    brand: 'Acne Studios',
    priceRupees: 32000,
    monthsAgo: 4,
    recentWears: 3,
    lastWornDaysAgo: 35,
    hex: '#0a0a0a',
    photoUrl: STITCH(
      'AB6AXuBv48cOeQ_lSNH19vQoV8Y9GUnqBqOfppjxqB9ia9sKSIUNgNS4BqMLJvBxHMZ-QoCbbWOmDaf2YQut22UPzX-VFaZhy71ibLJhAT9o1BNsOktgXx3Ml7AZfYO8SRvqITK9omGgX1RseYFZrJjonEbF8PK3J9KwqLSrf10b-vqFlLkEtr9hRCENfN3R_NQ3PM8g5WZb5DqIvjsEm9Vq-B_XUPd7AH2w2X7RD_dC67W5o8lJAzwrWAm6NA5G0JDCWA4kdRi2cIfCmEjG',
    ),
  },
  {
    name: 'Emerald Silk Kurta',
    category: 'Ethnic',
    color: 'Emerald',
    brand: 'Sabyasachi',
    priceRupees: 18500,
    monthsAgo: 10,
    recentWears: 2,
    lastWornDaysAgo: 50,
    hex: '#1f6845',
    photoUrl: STITCH(
      'AB6AXuAGyF2iuSgUzbfsmstDqJH4Ob6C2kAcUZ2sBUSpiAiOCluv2kNd4Kilv1Q27acVAbNEbihPzZZN92sUwrddvuJ1zAY1Hl13tofWT8JFZakzNaGgBrlcxkqyB_G6SbV6oGlsu_ZekZZsbdcXNYKNwtbqrkU1tLljW5X_bxzag79W5E1k7QvM0lSfDiAbSEj9meFjIURMKHM6yGHJT02KpHmaMvqZ9xQ7nsx0lm6IfMgSa6TRIAfZboxHVerYrdWLM2BT7m0r2sQdhMHi',
    ),
  },

  // Dormant
  {
    name: 'Ivory Silk Sherwani',
    category: 'Ethnic',
    color: 'Ivory',
    brand: 'Manyavar',
    priceRupees: 24000,
    monthsAgo: 6,
    recentWears: 1,
    lastWornDaysAgo: 75,
    hex: '#e8dec5',
    photoUrl: STITCH(
      'AB6AXuDvEnpxT107XMRH9u68mvUchnUM2dMfdENKx8JXvhS-VgONVbJE7Wzr0kY_8g23-JgNMBtGbDFW602V7BbYc6e4_vuARpdRgBVILAsf7eespezGf9UZvga8WFKPaMKvuudrvgERWF71x4380GEmE18s3OdEepSSymXVkKJPLgzhDHhy-F9yUO7Lx2KL0DBrmVCH7ev-tNCV9GJp1y20Er81kGXPFTc0aEsitbAf-NgNh4fVqY0jx7twkeHoMQU8V7dsK9IYkLi6ldae',
    ),
  },
  {
    name: 'Emerald Festive Kurta',
    category: 'Ethnic',
    color: 'Emerald',
    brand: 'Manyavar',
    priceRupees: 4999,
    monthsAgo: 5,
    recentWears: 0,
    lastWornDaysAgo: Infinity,
    hex: '#1f6845',
    photoUrl: STITCH(
      'AB6AXuAwSy_mdbIp0oj5ayYFIHhN5U_WBGKXoQhbsPamYjhWlX_QPAiwfcqTx9Qtzct_zkywVR0ruh4Hx08XUM_j9vk23YZ-y290mDy1pFGpZjsDNxBSZBcPrls2ZchBITn6wmIeHzGD6SVewxrnh2kHWacXnT-qeFyWr6IyzcfQ2xHeFqEs06tM17JJNLnVS-PUfud6FXrOCea34IQJu_3BUOEOkdy71tiruzKt1rmYC9wVQoHIr-lWl69hBHrGTgNLwkECoLxFwrwHnX7I',
    ),
  },
]

const OUTFITS: { name: string; itemNames: string[] }[] = [
  {
    name: 'Festive Day',
    itemNames: ['Beige Kurta', 'Embroidered Waistcoat', 'Leather Mojaris'],
  },
  {
    name: 'Office Casual',
    itemNames: [
      'White Formal Shirt',
      'Dark Tailored Trousers',
      'Polished Brogues',
    ],
  },
]

/**
 * Fetch a Stitch CDN photo and return it shaped for createItem({ photo }).
 * Throws on network failure — caller decides whether to fall back.
 */
async function fetchPhoto(url: string) {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Photo fetch HTTP ${resp.status}`)
  const blob = await resp.blob()
  const bitmap = await createImageBitmap(blob)
  const out = {
    blob,
    width: bitmap.width,
    height: bitmap.height,
    isProcessed: false,
  }
  bitmap.close()
  return out
}

/**
 * Canvas-generated solid-color square as a fallback when the network fetch
 * fails (offline, expired CDN URL, etc.). Same shape as fetchPhoto's return.
 */
async function fallbackPhoto(seed: SeedItem) {
  const size = 600
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = seed.hex
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = isLight(seed.hex) ? '#0E0E0F' : '#F5F5F4'
  ctx.font = 'bold 48px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(seed.name.split(' ').slice(-1)[0].toUpperCase(), size / 2, size / 2)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
      'image/jpeg',
      0.85,
    )
  })
  return { blob, width: size, height: size, isProcessed: false }
}

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55
}

/**
 * Pick `count` distinct day timestamps within `[lastWornDaysAgo, +90]` days
 * ago. Most recent wear is anchored at exactly `lastWornDaysAgo` so the
 * "last worn" copy on cards/insights is predictable.
 */
function generateWearDays(
  count: number,
  lastWornDaysAgo: number,
  today: number,
): number[] {
  if (count === 0 || !Number.isFinite(lastWornDaysAgo)) return []
  const days = new Set<number>()
  days.add(addDays(today, -lastWornDaysAgo))
  let attempts = 0
  while (days.size < count && attempts < count * 10) {
    const offset = lastWornDaysAgo + Math.floor(Math.random() * 90)
    days.add(addDays(today, -offset))
    attempts += 1
  }
  return Array.from(days)
}

export async function seedExampleData(): Promise<{
  itemsAdded: number
  wearsAdded: number
  outfitsAdded: number
  photoFallbacks: number
}> {
  const today = startOfDay()
  const yearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000

  let itemsAdded = 0
  let wearsAdded = 0
  let photoFallbacks = 0

  const namesToIds = new Map<string, string>()

  for (const seed of ITEMS) {
    let photo: Awaited<ReturnType<typeof fetchPhoto>>
    try {
      photo = await fetchPhoto(seed.photoUrl)
    } catch (err) {
      console.warn(
        `[seed] photo fetch failed for "${seed.name}", using fallback:`,
        err,
      )
      photo = await fallbackPhoto(seed)
      photoFallbacks += 1
    }

    const purchasedAt = seed.monthsAgo
      ? Date.now() - seed.monthsAgo * 30 * 24 * 60 * 60 * 1000
      : undefined

    const item = await createItem({
      name: seed.name,
      category: seed.category,
      color: seed.color,
      brand: seed.brand,
      purchasePriceMinor:
        seed.priceRupees != null ? seed.priceRupees * 100 : undefined,
      purchasedAt,
      seedWearCount: seed.seedWears,
      seedAsOf: seed.seedWears ? yearAgo : undefined,
      photo,
    })
    itemsAdded += 1
    namesToIds.set(seed.name, item.id)

    const wearDays = generateWearDays(
      seed.recentWears,
      seed.lastWornDaysAgo,
      today,
    )
    for (const wornAt of wearDays) {
      // eslint-disable-next-line no-await-in-loop
      await logWear({ itemId: item.id, wornAt })
      wearsAdded += 1
    }
  }

  let outfitsAdded = 0
  for (const out of OUTFITS) {
    const ids = out.itemNames
      .map((n) => namesToIds.get(n))
      .filter((id): id is string => !!id)
    if (ids.length === 0) continue
    await createOutfit({ name: out.name, itemIds: ids })
    outfitsAdded += 1
  }

  return { itemsAdded, wearsAdded, outfitsAdded, photoFallbacks }
}

/** Quick stat for the confirm button — already-seeded? */
export async function hasAnyData(): Promise<boolean> {
  const c = await db.items.count()
  return c > 0
}

// ─── Fill missing photos (dev tool) ─────────────────────────────────────────

/**
 * Common color names → hex, used to colour the placeholder swatches when an
 * item already has a stored `color` string. Covers the categories the
 * detection palette uses; unknown colors fall back to a hash-derived hex so
 * even ad-hoc names get a stable, distinct colour.
 */
const COLOR_NAME_TO_HEX: Record<string, string> = {
  black: '#0a0a0a',
  white: '#f5f5f4',
  gray: '#808080',
  grey: '#808080',
  charcoal: '#37373c',
  red: '#c81e1e',
  maroon: '#6e1e1e',
  orange: '#f0821e',
  yellow: '#f0dc32',
  mustard: '#c8aa28',
  green: '#28a050',
  emerald: '#1f6845',
  olive: '#78824a',
  teal: '#288c8c',
  blue: '#3264c8',
  navy: '#141e5a',
  indigo: '#1a2e4a',
  sky: '#78b4e6',
  purple: '#783cb4',
  pink: '#f082b4',
  brown: '#78461e',
  tan: '#c8aa82',
  beige: '#dcc8aa',
  cream: '#f0e6c8',
  khaki: '#b4aa82',
  ivory: '#e8dec5',
  earth: '#7a5430',
}

function hashHex(input: string): string {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0
  }
  // Bias toward muted, non-neon hues so placeholders look like clothing.
  const r = 60 + (Math.abs(h) % 140)
  const g = 60 + (Math.abs(h >> 8) % 140)
  const b = 60 + (Math.abs(h >> 16) % 140)
  return (
    '#' +
    [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
  )
}

function colorNameToHex(name?: string): string {
  if (!name) return '#26262a'
  const key = name.trim().toLowerCase()
  return COLOR_NAME_TO_HEX[key] ?? hashHex(key)
}

/**
 * Render a placeholder photo for an item using its color and a category-
 * derived label. Returns the same shape as the seed `fetchPhoto` so it can
 * flow into createItem / replaceItemPhoto unchanged.
 */
async function generatePlaceholder(opts: {
  hex: string
  label: string
}): Promise<{ blob: Blob; width: number; height: number }> {
  const size = 600
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = opts.hex
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = isLight(opts.hex) ? '#0E0E0F' : '#F5F5F4'
  ctx.font = 'bold 56px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(opts.label.toUpperCase(), size / 2, size / 2)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
      'image/jpeg',
      0.85,
    )
  })
  return { blob, width: size, height: size }
}

/**
 * Compute + store CLIP embeddings for every active item that doesn't have
 * one yet. Used by the Settings dev row to backfill duplicate-detection
 * data after adding items pre-feature.
 */
export async function backfillEmbeddings(
  onProgress?: (done: number, total: number) => void,
): Promise<{ indexed: number; skipped: number; failed: number }> {
  const { indexItemPhoto } = await import('@/lib/embeddings')
  const items = await db.items.toArray()
  const existing = new Set(
    (await db.itemEmbeddings.toArray()).map((e) => e.itemId),
  )
  const missing = items.filter(
    (it) => !it.archivedAt && it.primaryPhotoId && !existing.has(it.id),
  )
  let indexed = 0
  let failed = 0
  for (let i = 0; i < missing.length; i++) {
    const item = missing[i]
    onProgress?.(i, missing.length)
    try {
      const photo = await db.itemPhotos.get(item.primaryPhotoId!)
      if (!photo?.blob) {
        failed += 1
        continue
      }
      // eslint-disable-next-line no-await-in-loop
      await indexItemPhoto(item.id, photo.blob)
      indexed += 1
    } catch (err) {
      console.warn('[backfill] failed for', item.name, err)
      failed += 1
    }
  }
  onProgress?.(missing.length, missing.length)
  return {
    indexed,
    skipped: items.length - missing.length,
    failed,
  }
}

/**
 * For every active item without a `primaryPhotoId`, generate a colored
 * canvas placeholder based on the item's stored color + category. Lets the
 * test wardrobe render visually even when items were added without ML
 * detection or a real photo.
 */
export async function fillMissingPhotos(): Promise<{ filled: number }> {
  const items = await db.items.toArray()
  const missing = items.filter((it) => !it.archivedAt && !it.primaryPhotoId)
  let filled = 0
  for (const item of missing) {
    const hex = colorNameToHex(item.color)
    const label =
      item.category && item.category !== 'Other'
        ? item.category
        : item.name.split(/\s+/).slice(-1)[0] || 'Item'
    // eslint-disable-next-line no-await-in-loop
    const photo = await generatePlaceholder({ hex, label })
    const photoId = `photo_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 8)}`
    // eslint-disable-next-line no-await-in-loop
    await db.transaction('rw', db.items, db.itemPhotos, async () => {
      await db.itemPhotos.add({
        id: photoId,
        itemId: item.id,
        blob: photo.blob,
        width: photo.width,
        height: photo.height,
        isProcessed: false,
        createdAt: Date.now(),
      })
      await db.items.update(item.id, { primaryPhotoId: photoId })
    })
    filled += 1
  }
  return { filled }
}
