import { useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, Trash2, ChevronDown, Sparkles, Image as ImageIcon, Search, Gift } from 'lucide-react'
import { db } from '@/db/dexie'
import {
  deleteAllData,
  exportAllData,
  formatBytes,
  getStorageEstimate,
  type StorageEstimate,
} from '@/lib/dataExport'
import { toast } from '@/lib/toast'
import { useOverlay } from '@/lib/shell'
import { isIOS, usePrefs } from '@/lib/preferences'
import { DiagnosticsView } from '@/components/DiagnosticsView'
import { cn } from '@/lib/utils'
// TEMP — demo data seeder. Remove this import + the row below + the file
// itself (`src/lib/seedData.ts`) once you're done evaluating the new UI.
import {
  backfillEmbeddings,
  fillMissingPhotos,
  seedExampleData,
} from '@/lib/seedData'
import { computeWrapped, renderWrappedPng } from '@/lib/wrapped'

export function Settings() {
  const itemCount = useLiveQuery(() => db.items.count())
  const photoCount = useLiveQuery(() => db.itemPhotos.count())
  const wearCount = useLiveQuery(() => db.wears.count())
  const [storage, setStorage] = useState<StorageEstimate | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  const mlEnabled = usePrefs((s) => s.mlEnabled)
  const setMlEnabled = usePrefs((s) => s.setMlEnabled)

  // Hide the floating TabBar while the confirm dialog is open so the
  // destructive CTA isn't sitting next to a stray nav capsule.
  useOverlay(confirmDelete)

  useEffect(() => {
    getStorageEstimate().then(setStorage)
  }, [itemCount, photoCount, wearCount])

  async function handleExport() {
    setBusy(true)
    try {
      const blob = await exportAllData()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const date = new Date().toISOString().slice(0, 10)
      a.download = `hangr-export-${date}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Export downloaded')
    } catch (err) {
      console.error(err)
      toast.error('Export failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setBusy(true)
    try {
      await deleteAllData()
      toast.success('All data deleted')
      setConfirmDelete(false)
    } catch (err) {
      console.error(err)
      toast.error('Delete failed')
    } finally {
      setBusy(false)
    }
  }

  // TEMP — demo seeder (dev-only). Remove together with the import.
  async function handleSeed() {
    setBusy(true)
    toast.info('Fetching demo photos…')
    try {
      const { itemsAdded, wearsAdded, outfitsAdded, photoFallbacks } =
        await seedExampleData()
      const fallbackNote =
        photoFallbacks > 0 ? ` · ${photoFallbacks} photo(s) used fallback` : ''
      toast.success(
        `Seeded ${itemsAdded} items · ${wearsAdded} wears · ${outfitsAdded} outfits${fallbackNote}`,
      )
    } catch (err) {
      console.error(err)
      toast.error('Seed failed — check console')
    } finally {
      setBusy(false)
    }
  }

  // TEMP — generate placeholder photos for items that don't have one. Useful
  // while testing the redesign with seeded items that failed to fetch a real
  // photo. Remove with the rest of the seedData scaffolding.
  async function handleFillPhotos() {
    setBusy(true)
    try {
      const { filled } = await fillMissingPhotos()
      if (filled === 0) toast.info('No items missing photos')
      else toast.success(`Generated placeholders for ${filled} item${filled === 1 ? '' : 's'}`)
    } catch (err) {
      console.error(err)
      toast.error('Photo fill failed — check console')
    } finally {
      setBusy(false)
    }
  }

  // Compute CLIP embeddings for items that don't have one yet, so the
  // duplicate-detection check at capture time has a complete reference set.
  // First run downloads the model (~80 MB cached after).
  async function handleBackfillEmbeddings() {
    setBusy(true)
    toast.info('Indexing photos for duplicate detection…')
    try {
      const { indexed, failed } = await backfillEmbeddings()
      if (indexed === 0 && failed === 0) {
        toast.info('Everything already indexed')
      } else {
        const failNote = failed > 0 ? ` · ${failed} failed` : ''
        toast.success(`Indexed ${indexed} item${indexed === 1 ? '' : 's'}${failNote}`)
      }
    } catch (err) {
      console.error(err)
      toast.error('Indexing failed — check console')
    } finally {
      setBusy(false)
    }
  }

  // Build the year-in-clothes recap PNG and trigger a download. Renders
  // entirely client-side; nothing leaves the device unless the user shares it.
  async function handleWrapped() {
    setBusy(true)
    toast.info('Generating recap…')
    try {
      const year = new Date().getFullYear()
      const stats = await computeWrapped(year)
      if (stats.totalWears === 0) {
        toast.info('Nothing to recap yet — log a few wears first')
        return
      }
      const blob = await renderWrappedPng(stats)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `hangr-${year}-wrapped.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Saved ${year} recap`)
    } catch (err) {
      console.error(err)
      toast.error('Recap failed — check console')
    } finally {
      setBusy(false)
    }
  }

  const isEmpty = (itemCount ?? 0) === 0
  const usagePct =
    storage && storage.quotaBytes > 0
      ? Math.min(100, (storage.usageBytes / storage.quotaBytes) * 100)
      : 0

  return (
    <div className="px-5 pt-12 pb-4 max-w-md mx-auto">
      <header className="mb-7">
        <h1 className="font-display text-[28px] font-semibold tracking-tight text-ink-50 leading-tight">
          Settings
        </h1>
        <p className="mt-1 text-[13px] text-ink-300">
          Manage your app preferences and local data.
        </p>
      </header>

      {/* Privacy preamble — editorial header + brief reassurance */}
      <section className="mb-8">
        <h2 className="font-display italic text-[20px] font-medium text-ink-50 tracking-tight border-b border-hairline pb-2 mb-3">
          Privacy
        </h2>
        <div className="space-y-2 text-[14px] text-ink-300 leading-relaxed">
          <p>
            Hangr is local-first. Photos, wears, and item details live in
            IndexedDB on this device — nothing is uploaded.
          </p>
          <p>
            On-device ML downloads its models from Hugging Face once, then
            runs entirely in your browser. No accounts, no telemetry, no
            analytics.
          </p>
        </div>
      </section>

      {/* List of rows — hairline-separated */}
      <div className="flex flex-col">
        {/* On-device ML */}
        <Row>
          <div className="flex-1 min-w-0 pr-4">
            <div className="text-[15px] text-ink-50">
              On-device ML processing
            </div>
            <div className="mt-1 text-[12px] text-tertiary leading-snug">
              {isIOS
                ? 'Off by default on iOS. Loading the models pushes memory close to Safari\'s limit and can crash the page.'
                : 'Background removal & auto-detection. ~230MB downloaded once, then cached.'}
            </div>
          </div>
          <Toggle checked={mlEnabled} onChange={setMlEnabled} />
        </Row>
        {isIOS && mlEnabled && (
          <div className="mb-3 -mt-2 px-3 py-2 rounded-card bg-warning/10 border border-warning/30 text-warning text-[12px]">
            Heads up: on iOS, this can cause Safari to reload the page mid-capture
            if your device is low on memory. If that happens, turn it back off.
          </div>
        )}

        {/* Local storage */}
        <Row>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between">
              <div className="text-[15px] text-ink-50">Local storage</div>
              <div className="text-[12px] text-tertiary tabular-nums">
                {storage
                  ? `${formatBytes(storage.usageBytes)} / ${formatBytes(
                      storage.quotaBytes,
                    )}`
                  : '—'}
              </div>
            </div>
            <div className="mt-2 h-1 bg-surface-2 border border-hairline rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-[width]"
                style={{ width: `${usagePct}%` }}
              />
            </div>
            <div className="mt-2 text-[11px] text-tertiary tabular-nums">
              {itemCount ?? 0} items · {photoCount ?? 0} photos ·{' '}
              {wearCount ?? 0} wears
            </div>
          </div>
        </Row>

        {/* Year-in-clothes Wrapped — generates a shareable PNG */}
        <RowButton onClick={handleWrapped} disabled={busy || isEmpty}>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] text-ink-50">Year in clothes</div>
            <div className="mt-0.5 text-[12px] text-tertiary">
              Save a {new Date().getFullYear()} recap as a shareable image.
            </div>
          </div>
          <Gift
            size={18}
            strokeWidth={1.75}
            className="text-accent shrink-0"
          />
        </RowButton>

        {/* Export */}
        <RowButton onClick={handleExport} disabled={busy || isEmpty}>
          <span className="flex-1 text-[15px] text-ink-50">
            Export wardrobe data
          </span>
          <Download
            size={18}
            strokeWidth={1.75}
            className="text-ink-300 group-hover:text-accent transition-colors shrink-0"
          />
        </RowButton>

        {/* Diagnostics — expandable */}
        <RowButton
          onClick={() => setDiagnosticsOpen((v) => !v)}
          aria-expanded={diagnosticsOpen}
        >
          <span className="flex-1 text-[15px] text-ink-50">Diagnostics</span>
          <ChevronDown
            size={18}
            strokeWidth={1.75}
            className={cn(
              'text-ink-300 transition-transform shrink-0',
              diagnosticsOpen && 'rotate-180',
            )}
          />
        </RowButton>
        {diagnosticsOpen && (
          <div className="py-3 border-b border-hairline">
            <DiagnosticsView />
          </div>
        )}

        {/* About */}
        <Row>
          <span className="flex-1 text-[15px] text-ink-50">About Hangr</span>
          <span className="text-[12px] text-tertiary tabular-nums">v0.7</span>
        </Row>

        {/* Demo + danger actions — separated from the regular rows */}
        <div className="pt-12">
          {/* TEMP — dev-only demo seeder. Remove this block + the
              handleSeed function + the seedExampleData import once done. */}
          {import.meta.env.DEV && (
            <>
              <RowButton onClick={handleSeed} disabled={busy}>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] text-ink-50">Add example data</div>
                  <div className="mt-0.5 text-[12px] text-tertiary">
                    Dev-only · ~20 sample items, 90 days of wears, 2 outfits
                  </div>
                </div>
                <Sparkles
                  size={18}
                  strokeWidth={1.75}
                  className="text-accent shrink-0"
                />
              </RowButton>

              <RowButton onClick={handleFillPhotos} disabled={busy}>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] text-ink-50">Fill missing photos</div>
                  <div className="mt-0.5 text-[12px] text-tertiary">
                    Dev-only · canvas placeholders coloured from each item's color
                  </div>
                </div>
                <ImageIcon
                  size={18}
                  strokeWidth={1.75}
                  className="text-accent shrink-0"
                />
              </RowButton>

              <RowButton onClick={handleBackfillEmbeddings} disabled={busy}>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] text-ink-50">
                    Index for duplicate detection
                  </div>
                  <div className="mt-0.5 text-[12px] text-tertiary">
                    Compute CLIP embeddings for existing items so capture warns
                    when you may already own something similar.
                  </div>
                </div>
                <Search
                  size={18}
                  strokeWidth={1.75}
                  className="text-accent shrink-0"
                />
              </RowButton>
            </>
          )}

          <RowButton
            onClick={() => setConfirmDelete(true)}
            disabled={busy || isEmpty}
            danger
          >
            <div className="flex-1 min-w-0">
              <div className="text-[15px] text-danger">Delete all data</div>
              <div className="mt-0.5 text-[12px] text-danger/70">
                Irreversibly remove items, photos, and wears
              </div>
            </div>
            <Trash2
              size={18}
              strokeWidth={1.75}
              className="text-danger/70 group-hover:text-danger transition-colors shrink-0"
            />
          </RowButton>
        </div>
      </div>

      <div className="mt-8 text-[11px] text-tertiary text-center font-mono break-all">
        build · {__BUILD_TIME__}
      </div>

      <div className="mt-3 text-[11px] text-tertiary text-center">
        Built by{' '}
        <a
          href="https://derajyojith.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          Deraj
        </a>{' '}
        · all data stays on your device
      </div>

      {confirmDelete && (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center bg-ink-950/80 backdrop-blur-sm p-4"
          onClick={() => !busy && setConfirmDelete(false)}
        >
          <div
            className="bg-surface-1 border border-hairline rounded-card p-5 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-[18px] font-medium text-ink-50">
              Delete everything?
            </h3>
            <p className="mt-2 text-[13px] text-ink-300 leading-relaxed">
              This permanently removes all items, photos, and wear logs from
              this device. Cannot be undone.
            </p>
            <div className="mt-5 flex items-center gap-2 justify-end">
              <button
                disabled={busy}
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 rounded-full text-sm text-ink-300 hover:text-ink-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={busy}
                onClick={handleDelete}
                className="px-4 py-2 rounded-full bg-danger text-ink-950 text-sm font-medium disabled:opacity-50"
              >
                {busy ? 'Deleting…' : 'Delete everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-4 border-b border-hairline">
      {children}
    </div>
  )
}

function RowButton({
  children,
  onClick,
  disabled,
  danger,
  ...rest
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  'aria-expanded'?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group flex items-center gap-3 py-4 border-b border-hairline text-left transition-colors disabled:opacity-40',
        !danger && 'hover:[&_span:first-child]:text-accent',
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors',
        checked
          ? 'bg-accent border-accent'
          : 'bg-surface-2 border-hairline',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-[18px] w-[18px] rounded-full transition-transform',
          checked
            ? 'translate-x-[22px] bg-ink-950'
            : 'translate-x-0.5 bg-ink-300',
        )}
      />
    </button>
  )
}
