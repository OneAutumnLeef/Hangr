import { useEffect, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Sheet } from './Sheet'
import { CATEGORIES } from './ItemForm'
import { listItems } from '@/db/items'
import { loadAllAnalytics, inventoryForCategory } from '@/lib/analytics'

export interface WantFormValues {
  name: string
  category?: string
  color?: string
  brand?: string
  estimatedPriceRupees?: number
  source?: string
  note?: string
}

interface Props {
  open: boolean
  onClose: () => void
  onSave: (values: WantFormValues) => void
  initial?: WantFormValues
  /** When provided, the sheet renders with the "Edit want" framing. */
  editing?: boolean
}

/**
 * Add or edit a want. The category dropdown drives an inline inventory check
 * — once a category is picked, we show how many of those items the user
 * already owns, their average ₹/wear, and how many sit dormant. The point
 * isn't to block the purchase, it's to surface the question.
 */
export function WantEditorSheet({
  open,
  onClose,
  onSave,
  initial,
  editing,
}: Props) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [color, setColor] = useState('')
  const [brand, setBrand] = useState('')
  const [price, setPrice] = useState('')
  const [source, setSource] = useState('')
  const [note, setNote] = useState('')

  // Reset / reseed when (re)opening.
  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setCategory(initial?.category ?? '')
    setColor(initial?.color ?? '')
    setBrand(initial?.brand ?? '')
    setPrice(
      initial?.estimatedPriceRupees != null
        ? String(initial.estimatedPriceRupees)
        : '',
    )
    setSource(initial?.source ?? '')
    setNote(initial?.note ?? '')
  }, [open, initial])

  // Live inventory check for the chosen category. Skipped while no category.
  const items = useLiveQuery(() => listItems())
  const analytics = useLiveQuery(() =>
    category ? loadAllAnalytics() : Promise.resolve(null),
  )
  const inventory =
    category && analytics
      ? inventoryForCategory(analytics.items, category)
      : null

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      category: category || undefined,
      color: color.trim() || undefined,
      brand: brand.trim() || undefined,
      estimatedPriceRupees: price ? Number(price) : undefined,
      source: source.trim() || undefined,
      note: note.trim() || undefined,
    })
  }

  const canSave = name.trim().length > 0

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Edit want' : 'Considering buying…'}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full text-sm text-ink-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="want-editor-form"
            disabled={!canSave}
            className="px-4 py-2 rounded-full bg-accent text-ink-950 text-sm font-medium disabled:opacity-40"
          >
            {editing ? 'Save changes' : 'Add to want list'}
          </button>
        </div>
      }
    >
      <form
        id="want-editor-form"
        onSubmit={handleSubmit}
        className="px-4 py-3 space-y-3"
      >
        <Field label="What is it?" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Black wool overshirt"
            className="form-input"
            autoFocus
            maxLength={80}
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

        {/* Inventory cross-check — the whole reason this feature exists */}
        {inventory && items && (
          <InventoryCheck inventory={inventory} totalItems={items.length} />
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Color">
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="Black"
              className="form-input"
            />
          </Field>
          <Field label="Brand">
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="COS"
              className="form-input"
            />
          </Field>
        </div>

        <Field label="Estimated price (₹)">
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ''))}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="6500"
            className="form-input"
          />
        </Field>

        <Field label="Where did you see it?">
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="cosstores.com / brand store / Insta ad"
            className="form-input"
            maxLength={200}
          />
        </Field>

        <Field label="Why do you want it?">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Wedding next month · don't have anything dressy in this colour"
            className="form-input resize-none"
            rows={3}
            maxLength={500}
          />
        </Field>
      </form>
    </Sheet>
  )
}

function InventoryCheck({
  inventory,
  totalItems,
}: {
  inventory: ReturnType<typeof inventoryForCategory>
  totalItems: number
}) {
  if (inventory.itemCount === 0) {
    return (
      <div className="rounded-card border border-hairline bg-surface-1 px-3 py-2.5 text-[12px]">
        <span className="text-accent">Nothing yet</span>
        <span className="text-tertiary">
          {' '}
          in {inventory.category}. {totalItems > 0 ? 'A genuine gap.' : ''}
        </span>
      </div>
    )
  }
  const avgRupees =
    inventory.avgCostPerWear != null
      ? Math.round(inventory.avgCostPerWear).toLocaleString('en-IN')
      : null
  return (
    <div className="rounded-card border border-hairline bg-surface-1 px-3 py-2.5 text-[12px] space-y-1">
      <div>
        <span className="text-ink-50 tabular-nums font-medium">
          {inventory.itemCount}
        </span>
        <span className="text-tertiary">
          {' '}
          {inventory.category.toLowerCase()}
          {inventory.itemCount === 1 ? '' : 's'} already in your closet.
        </span>
      </div>
      <div className="flex items-center gap-3 text-tertiary">
        {avgRupees != null && (
          <span>
            avg{' '}
            <span className="text-ink-100 tabular-nums">₹{avgRupees}/wear</span>
          </span>
        )}
        {inventory.dormantCount > 0 && (
          <span>
            <span className="text-warning tabular-nums">
              {inventory.dormantCount}
            </span>{' '}
            dormant
          </span>
        )}
        {inventory.spentMinor > 0 && (
          <span>
            spent{' '}
            <span className="text-ink-100 tabular-nums">
              ₹{(inventory.spentMinor / 100).toLocaleString('en-IN')}
            </span>
          </span>
        )}
      </div>
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-xs text-ink-400 mb-1 inline-block">
        {label}
        {required && <span className="text-accent ml-0.5">*</span>}
      </span>
      {children}
    </label>
  )
}
