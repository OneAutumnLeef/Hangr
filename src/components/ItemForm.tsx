import { useState, type FormEvent, type ReactNode } from 'react'

export interface ItemFormValues {
  name: string
  category?: string
  color?: string
  brand?: string
  /** Whole rupees from the input. We convert to minor (paise) at the call site. */
  priceRupees?: number
  purchasedAt?: number
}

interface Props {
  onSubmit: (values: ItemFormValues) => void
  disabled?: boolean
  initial?: Partial<ItemFormValues>
  submitLabel?: string
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

export function ItemForm({ onSubmit, disabled, initial, submitLabel }: Props) {
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onSubmit({
      name: name.trim(),
      category: category || undefined,
      color: color.trim() || undefined,
      brand: brand.trim() || undefined,
      priceRupees: price ? Number(price) : undefined,
      purchasedAt: purchasedAt ? new Date(purchasedAt).getTime() : undefined,
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

      <Field label="Category">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
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
        <Field label="Color">
          <input
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="Navy"
            className="form-input"
          />
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
  children,
}: {
  label: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-xs text-ink-400 mb-1">
        {label}
        {required && <span className="text-accent ml-0.5">*</span>}
      </span>
      {children}
    </label>
  )
}
