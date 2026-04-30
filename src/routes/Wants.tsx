import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Plus,
  ArrowLeft,
  Check,
  X,
  Pencil,
  ShoppingBag,
} from 'lucide-react'
import {
  createWant,
  decideWant,
  deleteWant,
  listWants,
  updateWant,
} from '@/db/wants'
import type { Want } from '@/db/dexie'
import { listItems } from '@/db/items'
import {
  loadAllAnalytics,
  inventoryForCategory,
} from '@/lib/analytics'
import { shortDate } from '@/lib/dates'
import {
  WantEditorSheet,
  type WantFormValues,
} from '@/components/WantEditorSheet'
import { EmptyState } from '@/components/EmptyState'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

export function Wants() {
  const wants = useLiveQuery(() => listWants({ includeDecided: true }))
  const items = useLiveQuery(() => listItems())
  const analytics = useLiveQuery(() => loadAllAnalytics())

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Want | null>(null)
  const [showDecided, setShowDecided] = useState(false)

  const undecided = useMemo(
    () => (wants ?? []).filter((w) => w.decision == null),
    [wants],
  )
  const decided = useMemo(
    () => (wants ?? []).filter((w) => w.decision != null),
    [wants],
  )

  async function handleSave(values: WantFormValues) {
    const payload = {
      name: values.name,
      category: values.category,
      color: values.color,
      brand: values.brand,
      estimatedPriceMinor:
        values.estimatedPriceRupees != null
          ? values.estimatedPriceRupees * 100
          : undefined,
      source: values.source,
      note: values.note,
    }
    if (editing) {
      await updateWant(editing.id, payload)
      toast.success('Updated')
    } else {
      await createWant(payload)
      toast.success('Added to want list')
    }
    setEditorOpen(false)
    setEditing(null)
  }

  async function handleBought(want: Want) {
    await decideWant(want.id, 'bought')
    toast.success(`Marked "${want.name}" bought`)
  }

  async function handlePassed(want: Want) {
    await decideWant(want.id, 'passed')
    toast.success(`Passed on "${want.name}"`)
  }

  async function handleDelete(want: Want) {
    await deleteWant(want.id)
    toast.success('Removed')
  }

  function openEdit(want: Want) {
    setEditing(want)
    setEditorOpen(true)
  }

  function openNew() {
    setEditing(null)
    setEditorOpen(true)
  }

  if (wants === undefined) {
    return (
      <div className="px-5 pt-12 max-w-md mx-auto">
        <div className="h-8 w-32 rounded-md bg-surface-2 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="px-5 pt-12 pb-4 max-w-md mx-auto">
      <header className="mb-6 flex items-start gap-3">
        <Link
          to="/closet"
          aria-label="Back to closet"
          className="-ml-2 p-2 text-ink-300 hover:text-ink-50 transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-ink-50 leading-tight">
            Want list
          </h1>
          <p className="mt-1 text-[13px] text-ink-300">
            Pause before you buy. The closet check happens here.
          </p>
        </div>
        <button
          onClick={openNew}
          aria-label="Add want"
          className="h-10 w-10 shrink-0 rounded-full bg-accent text-ink-950 flex items-center justify-center active:scale-95 transition-transform"
        >
          <Plus size={20} strokeWidth={2.25} />
        </button>
      </header>

      {undecided.length === 0 && decided.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag size={48} strokeWidth={1.5} />}
          title="Nothing under consideration"
          message="Add items here while you're thinking about buying. We'll cross-check against what you already own."
          actionLabel="Add a want"
          onAction={openNew}
        />
      ) : (
        <>
          {undecided.length > 0 && (
            <ul className="space-y-3">
              {undecided.map((w) => (
                <WantCard
                  key={w.id}
                  want={w}
                  inventoryItemCount={
                    w.category && analytics
                      ? inventoryForCategory(analytics.items, w.category)
                          .itemCount
                      : 0
                  }
                  inventoryDormantCount={
                    w.category && analytics
                      ? inventoryForCategory(analytics.items, w.category)
                          .dormantCount
                      : 0
                  }
                  totalItems={items?.length ?? 0}
                  onEdit={() => openEdit(w)}
                  onBought={() => handleBought(w)}
                  onPassed={() => handlePassed(w)}
                  onDelete={() => handleDelete(w)}
                />
              ))}
            </ul>
          )}

          {undecided.length === 0 && (
            <p className="text-sm text-tertiary py-4">
              Nothing under consideration right now.
            </p>
          )}

          {decided.length > 0 && (
            <section className="mt-10">
              <button
                type="button"
                onClick={() => setShowDecided((v) => !v)}
                className="text-[11px] uppercase tracking-wider text-tertiary hover:text-ink-50 transition-colors"
              >
                {showDecided ? 'Hide' : 'Show'} decided ({decided.length})
              </button>
              {showDecided && (
                <ul className="mt-3 space-y-2">
                  {decided.map((w) => (
                    <li
                      key={w.id}
                      className={cn(
                        'rounded-card border border-hairline bg-surface-1 px-3 py-2.5 flex items-baseline justify-between gap-3',
                        w.decision === 'passed' && 'opacity-60',
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-ink-50 truncate">
                          {w.name}
                        </div>
                        <div className="text-[11px] text-tertiary tabular-nums">
                          {w.decision === 'bought' ? 'Bought' : 'Passed'} ·{' '}
                          {w.decidedAt && shortDate(w.decidedAt)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(w)}
                        className="text-[11px] text-tertiary hover:text-danger transition-colors"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      <WantEditorSheet
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false)
          setEditing(null)
        }}
        onSave={handleSave}
        editing={!!editing}
        initial={
          editing
            ? {
                name: editing.name,
                category: editing.category,
                color: editing.color,
                brand: editing.brand,
                estimatedPriceRupees:
                  editing.estimatedPriceMinor != null
                    ? editing.estimatedPriceMinor / 100
                    : undefined,
                source: editing.source,
                note: editing.note,
              }
            : undefined
        }
      />
    </div>
  )
}

interface WantCardProps {
  want: Want
  inventoryItemCount: number
  inventoryDormantCount: number
  totalItems: number
  onEdit: () => void
  onBought: () => void
  onPassed: () => void
  onDelete: () => void
}

function WantCard({
  want,
  inventoryItemCount,
  inventoryDormantCount,
  totalItems,
  onEdit,
  onBought,
  onPassed,
  onDelete,
}: WantCardProps) {
  return (
    <li className="rounded-card border border-hairline bg-surface-1 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-display text-[18px] text-ink-50 leading-tight">
            {want.name}
          </div>
          <div className="mt-1 text-[12px] text-tertiary tabular-nums flex items-baseline flex-wrap gap-x-2">
            {want.category && <span>{want.category}</span>}
            {want.brand && <span>· {want.brand}</span>}
            {want.color && <span>· {want.color}</span>}
            {want.estimatedPriceMinor != null && (
              <span className="text-ink-100">
                · ₹
                {(want.estimatedPriceMinor / 100).toLocaleString('en-IN')}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit want"
          className="p-2 -m-2 text-tertiary hover:text-ink-50 transition-colors"
        >
          <Pencil size={14} strokeWidth={1.75} />
        </button>
      </div>

      {want.note && (
        <div className="text-[13px] text-ink-200 leading-relaxed italic font-display">
          “{want.note}”
        </div>
      )}

      {/* Inventory cross-check inline */}
      {want.category && (
        <div className="text-[12px] text-tertiary border-t border-hairline pt-3">
          {inventoryItemCount === 0 ? (
            <>
              <span className="text-accent">Nothing yet</span> in{' '}
              {want.category.toLowerCase()}.{' '}
              {totalItems > 0 ? 'A genuine gap.' : ''}
            </>
          ) : (
            <>
              You already own{' '}
              <span className="text-ink-50 tabular-nums">
                {inventoryItemCount}
              </span>{' '}
              {want.category.toLowerCase()}
              {inventoryItemCount === 1 ? '' : 's'}
              {inventoryDormantCount > 0 && (
                <>
                  {' '}
                  ·{' '}
                  <span className="text-warning tabular-nums">
                    {inventoryDormantCount}
                  </span>{' '}
                  dormant
                </>
              )}
              .
            </>
          )}
        </div>
      )}

      {want.source && (
        <div className="text-[11px] text-tertiary truncate">
          via {want.source}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onBought}
          className="flex-1 px-3 py-2 rounded-full bg-accent text-ink-950 text-[12px] font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
        >
          <Check size={12} strokeWidth={2.5} /> Bought
        </button>
        <button
          type="button"
          onClick={onPassed}
          className="flex-1 px-3 py-2 rounded-full bg-surface-2 border border-hairline text-ink-200 text-[12px] font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 hover:text-ink-50 transition-colors"
        >
          <X size={12} strokeWidth={2.5} /> Pass
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete"
          className="p-2 text-tertiary hover:text-danger transition-colors"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
    </li>
  )
}
