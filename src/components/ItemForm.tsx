import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Wand2, ChevronDown, History } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ItemFormValues {
  name: string
  category?: string
  color?: string
  brand?: string
  /** Whole rupees from the input. We convert to minor (paise) at the call site. */
  priceRupees?: number
  purchasedAt?: number
  /** Pre-Hangr baseline: rough number of times worn before adding. */
  seedWearCount?: number
  /** "Owned since" — when the seed period began. */
  seedAsOf?: number
}

export interface DetectedFields {
  category?: string
  color?: string
  /** Hex code behind the named color — used for the swatch chip in the UI. */
  colorHex?: string
}

interface Props {
  onSubmit: (values: ItemFormValues) => void
  disabled?: boolean
  initial?: Partial<ItemFormValues>
  submitLabel?: string
  /**
   * Auto-detected suggestions. When this prop transitions from undefined to a
   * value, empty fields are filled. Existing user input is never overwritten.
   */
  detected?: DetectedFields
}

export const CATEGORIES = [
  'Top',
  'Bottom',
  'Outerwear',
  'Shoes',
  'Dress',
  'Ethnic',
  'Accessory',
  'Innerwear',
  'Other',
]

const SEED_PRESETS: { label: string; count: number }[] = [
  { label: 'A few', count: 3 },
  { label: 'Some', count: 10 },
  { label: 'Many', count: 25 },
  { label: 'A lot', count: 60 },
  { label: 'Heavy', count: 150 },
]

/** Today, minus N years. Used for the default "owned since" suggestion. */
function yearsAgoISO(years: number): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - years)
  return d.toISOString().slice(0, 10)
}

export function ItemForm({
  onSubmit,
  disabled,
  initial,
  submitLabel,
  detected,
}: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [color, setColor] = useState(initial?.color ?? '')
  const [brand, setBrand] = useState(initial?.brand ?? '')
  const [price, setPrice] = useState<string>(
    initial?.priceRupees != null ? String(initial.priceRupees) : '',
  )
  const [purchasedAt, setPurchasedAt] = useState<string>(
    initial?.purchasedAt
      ? new Date(initial.purchasedAt).toISOString().slice(0, 10)
      : '',
  )

  // Pre-owned ("Already owned this") section state
  const [showSeed, setShowSeed] = useState<boolean>(
    initial?.seedWearCount != null && initial.seedWearCount > 0,
  )
  const [seedWearCount, setSeedWearCount] = useState<string>(
    initial?.seedWearCount != null ? String(initial.seedWearCount) : '',
  )
  const [seedAsOf, setSeedAsOf] = useState<string>(
    initial?.seedAsOf
      ? new Date(initial.seedAsOf).toISOString().slice(0, 10)
      : '',
  )

  // One-time apply of detection results: when `detected` first becomes
  // non-empty, fill any empty fields. We never overwrite existing user input.
  const appliedRef = useRef(false)
  const [filledFromDetect, setFilledFromDetect] = useState<{
    category?: boolean
    color?: boolean
  }>({})

  useEffect(() => {
    if (appliedRef.current) return
    if (!detected) return
    if (!detected.category && !detected.color) return
    let didAny = false
    const next: typeof filledFromDetect = {}
    if (detected.category && !category) {
      setCategory(detected.category)
      next.category = true
      didAny = true
    }
    if (detected.color && !color) {
      setColor(detected.color)
      next.color = true
      didAny = true
    }
    if (didAny) {
      setFilledFromDetect(next)
      appliedRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detected])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const seedCount =
      showSeed && seedWearCount ? Number(seedWearCount) : undefined
    onSubmit({
      name: name.trim(),
      category: category || undefined,
      color: color.trim() || undefined,
      brand: brand.trim() || undefined,
      priceRupees: price ? Number(price) : undefined,
      purchasedAt: purchasedAt ? new Date(purchasedAt).getTime() : undefined,
      seedWearCount:
        seedCount != null && seedCount > 0 ? seedCount : undefined,
      seedAsOf:
        showSeed && seedAsOf ? new Date(seedAsOf).getTime() : undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Field label="Name" required>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Navy linen shirt"
          required
          autoFocus
          className="form-input"
        />
      </Field>

      <Field
        label="Category"
        suggestion={
          filledFromDetect.category
            ? { label: 'auto-detected', icon: <Wand2 size={10} /> }
            : undefined
        }
      >
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value)
            setFilledFromDetect((p) => ({ ...p, category: false }))
          }}
          className="form-input"
        >
          <option value="">—</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Color"
          suggestion={
            filledFromDetect.color
              ? { label: 'auto-detected', icon: <Wand2 size={10} /> }
              : undefined
          }
        >
          <div className="relative">
            {detected?.colorHex && filledFromDetect.color && (
              <span
                className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border border-ink-700"
                style={{ backgroundColor: detected.colorHex }}
                aria-hidden
              />
            )}
            <input
              value={color}
              onChange={(e) => {
                setColor(e.target.value)
                setFilledFromDetect((p) => ({ ...p, color: false }))
              }}
              placeholder="Navy"
              className={
                'form-input ' +
                (detected?.colorHex && filledFromDetect.color ? 'pl-8' : '')
              }
            />
          </div>
        </Field>
        <Field label="Brand">
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Uniqlo"
            className="form-input"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Price (₹)">
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ''))}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="2499"
            className="form-input"
          />
        </Field>
        <Field label="Purchased on">
          <input
            type="date"
            value={purchasedAt}
            onChange={(e) => setPurchasedAt(e.target.value)}
            className="form-input"
          />
        </Field>
      </div>

      {/* Pre-owned section — collapsed by default for new items */}
      <div className="rounded-2xl border border-ink-800 bg-ink-900/40">
        <button
          type="button"
          onClick={() => {
            const next = !showSeed
            setShowSeed(next)
            // Auto-fill a sensible default for "owned since" when opening
            if (next && !seedAsOf) setSeedAsOf(yearsAgoISO(1))
          }}
          className="w-full flex items-center justify-between px-3 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <History size={14} className="text-accent" />
            <div>
              <div className="text-sm">I've already owned this</div>
              <div className="text-xs text-ink-500">
                {showSeed
                  ? 'Counts past wears toward stats'
                  : 'For items already in rotation before today'}
              </div>
            </div>
          </div>
          <ChevronDown
            size={16}
            className={cn(
              'text-ink-400 transition-transform',
              showSeed && 'rotate-180',
            )}
          />
        </button>

        {showSeed && (
          <div className="px-3 pb-3 space-y-3">
            <Field label="Roughly how many times worn?">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {SEED_PRESETS.map((p) => (
                  <button
                    type="button"
                    key={p.label}
                    onClick={() => setSeedWearCount(String(p.count))}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs border transition',
                      seedWearCount === String(p.count)
                        ? 'bg-accent text-ink-950 border-accent'
                        : 'bg-ink-800 text-ink-300 border-ink-700 hover:text-ink-50',
                    )}
                  >
                    {p.label}{' '}
                    <span className="opacity-60">~{p.count}</span>
                  </button>
                ))}
              </div>
              <input
                value={seedWearCount}
                onChange={(e) =>
                  setSeedWearCount(e.target.value.replace(/[^0-9]/g, ''))
                }
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="e.g. 25"
                className="form-input"
              />
            </Field>

            <Field label="Owned since (approx)">
              <input
                type="date"
                value={seedAsOf}
                onChange={(e) => setSeedAsOf(e.target.value)}
                className="form-input"
              />
            </Field>

            <p className="text-xs text-ink-500 leading-relaxed">
              These count toward total wears, cost-per-wear, and "most worn"
              stats. Exact values aren't important — a guess is better than
              nothing.
            </p>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={disabled || !name.trim()}
        className="w-full mt-2 px-4 py-3 rounded-2xl bg-accent text-ink-950 font-medium active:scale-[0.99] transition disabled:opacity-40"
      >
        {disabled ? 'Saving…' : (submitLabel ?? 'Save to closet')}
      </button>
    </form>
  )
}

function Field({
  label,
  required,
  suggestion,
  children,
}: {
  label: string
  required?: boolean
  suggestion?: { label: string; icon?: ReactNode }
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-xs text-ink-400 mb-1">
        <span>
          {label}
          {required && <span className="text-accent ml-0.5">*</span>}
        </span>
        {suggestion && (
          <span className="inline-flex items-center gap-1 text-accent/80">
            {suggestion.icon}
            {suggestion.label}
          </span>
        )}
      </span>
      {children}
    </label>
  )
}
