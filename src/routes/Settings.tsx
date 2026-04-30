import { useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Download,
  Trash2,
  Shield,
  HardDrive,
  Github,
  Cpu,
  Bug,
} from 'lucide-react'
import { db } from '@/db/dexie'
import {
  deleteAllData,
  exportAllData,
  formatBytes,
  getStorageEstimate,
  type StorageEstimate,
} from '@/lib/dataExport'
import { toast } from '@/lib/toast'
import { isIOS, usePrefs } from '@/lib/preferences'
import { DiagnosticsView } from '@/components/DiagnosticsView'

export function Settings() {
  const itemCount = useLiveQuery(() => db.items.count())
  const photoCount = useLiveQuery(() => db.itemPhotos.count())
  const wearCount = useLiveQuery(() => db.wears.count())
  const [storage, setStorage] = useState<StorageEstimate | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const mlEnabled = usePrefs((s) => s.mlEnabled)
  const setMlEnabled = usePrefs((s) => s.setMlEnabled)

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

  const isEmpty = (itemCount ?? 0) === 0

  return (
    <div className="px-4 pt-12 pb-4 max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      <Section icon={<Shield size={16} />} title="Privacy">
        <div className="space-y-3 text-sm text-ink-300 leading-relaxed">
          <p>
            Hangr is local-first. Photos, wears, and item details live in
            IndexedDB on this device — nothing is uploaded.
          </p>
          <p>
            Background removal runs in your browser. The model is downloaded
            once from Hugging Face and then cached locally; nothing about your
            photos goes anywhere after that.
          </p>
          <p>
            No account, no telemetry, no analytics, no third-party tracking.
            You can verify this by opening DevTools → Network.
          </p>
        </div>
      </Section>

      <Section icon={<Cpu size={16} />} title="On-device ML">
        <button
          type="button"
          onClick={() => setMlEnabled(!mlEnabled)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-ink-800 border border-ink-700 active:scale-[0.99] transition"
        >
          <div className="text-left flex-1 min-w-0">
            <div className="text-sm">Background removal & auto-detection</div>
            <div className="mt-0.5 text-xs text-ink-500 leading-snug">
              {isIOS
                ? 'Off by default on iOS. Loading the models pushes memory close to Safari\'s limit and can crash the page.'
                : 'Runs RMBG-1.4 + CLIP entirely in your browser. ~230MB total, downloaded once.'}
            </div>
          </div>
          <span
            className={
              'shrink-0 inline-flex h-6 w-10 rounded-full p-0.5 transition ' +
              (mlEnabled ? 'bg-accent' : 'bg-ink-700')
            }
          >
            <span
              className={
                'h-5 w-5 rounded-full bg-ink-50 transition-transform ' +
                (mlEnabled ? 'translate-x-4' : 'translate-x-0')
              }
            />
          </span>
        </button>
        {isIOS && mlEnabled && (
          <div className="mt-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
            Heads up: on iOS, this can cause Safari to reload the page mid-capture
            if your device is low on memory. If that happens, turn it back off.
          </div>
        )}
      </Section>

      <Section icon={<HardDrive size={16} />} title="Storage">
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Items" value={itemCount ?? 0} />
          <Stat label="Photos" value={photoCount ?? 0} />
          <Stat label="Wears" value={wearCount ?? 0} />
        </div>
        {storage && (
          <div className="mt-3 text-xs text-ink-500">
            Using {formatBytes(storage.usageBytes)} of{' '}
            {formatBytes(storage.quotaBytes)} available on this device
          </div>
        )}
      </Section>

      <Section title="Data">
        <button
          onClick={handleExport}
          disabled={busy || isEmpty}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-ink-800 border border-ink-700 active:scale-[0.99] disabled:opacity-40 transition"
        >
          <Download size={18} className="text-accent shrink-0" />
          <div className="text-left flex-1">
            <div className="text-sm">Export all data</div>
            <div className="text-xs text-ink-500">
              Single JSON file. Photos included as data URLs.
            </div>
          </div>
        </button>

        <button
          onClick={() => setConfirmDelete(true)}
          disabled={busy || isEmpty}
          className="mt-3 w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/30 active:scale-[0.99] disabled:opacity-40 transition"
        >
          <Trash2 size={18} className="text-red-400 shrink-0" />
          <div className="text-left flex-1">
            <div className="text-sm text-red-300">Delete all data</div>
            <div className="text-xs text-red-400/70">
              Wipes items, photos, wears
            </div>
          </div>
        </button>
      </Section>

      <Section icon={<Bug size={16} />} title="Diagnostics">
        <DiagnosticsView />
      </Section>

      <Section icon={<Github size={16} />} title="About">
        <div className="text-sm text-ink-300 leading-relaxed">
          Hangr v0.5 — a privacy-first wardrobe tracker. Built by Deraj.
        </div>
        <div className="mt-3 text-[10px] text-ink-500 font-mono break-all">
          build: {__BUILD_TIME__}
        </div>
      </Section>

      <div className="mt-8 text-center text-xs text-ink-500">
        Made with care · all data stays on your device
      </div>

      {confirmDelete && (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center bg-ink-950/80 backdrop-blur p-4"
          onClick={() => !busy && setConfirmDelete(false)}
        >
          <div
            className="bg-ink-900 border border-ink-800 rounded-2xl p-5 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">Delete everything?</h3>
            <p className="mt-2 text-sm text-ink-400">
              This permanently removes all items, photos, and wear logs from
              this device. Cannot be undone.
            </p>
            <div className="mt-5 flex items-center gap-2 justify-end">
              <button
                disabled={busy}
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 rounded-full text-sm text-ink-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={busy}
                onClick={handleDelete}
                className="px-4 py-2 rounded-full bg-red-500 text-white text-sm font-medium disabled:opacity-50"
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

function Section({
  icon,
  title,
  children,
}: {
  icon?: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        {icon && <span className="text-accent">{icon}</span>}
        <h2 className="text-xs font-medium uppercase tracking-wide text-ink-400">
          {title}
        </h2>
      </div>
      {children}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-ink-800 border border-ink-800 p-3">
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-ink-400">{label}</div>
    </div>
  )
}
