import { useEffect, useState } from 'react'
import { Copy, Trash2, Bug, RefreshCw } from 'lucide-react'
import {
  clearLogs,
  formatAll,
  getLogs,
  subscribe,
  type LogEntry,
} from '@/lib/diagnostics'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

const LEVEL_STYLES: Record<LogEntry['level'], string> = {
  log: 'text-ink-300',
  info: 'text-ink-300',
  warn: 'text-amber-300',
  error: 'text-red-300',
}

export function DiagnosticsView() {
  const [logs, setLogs] = useState<LogEntry[]>(() => getLogs())
  const [filter, setFilter] = useState<'all' | 'errors'>('all')

  useEffect(() => {
    return subscribe(() => setLogs(getLogs()))
  }, [])

  const filtered =
    filter === 'errors'
      ? logs.filter((l) => l.level === 'error' || l.level === 'warn')
      : logs

  async function copyAll() {
    try {
      const text = formatAll(filtered)
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback: hidden textarea + execCommand (older iOS)
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      toast.success(`Copied ${filtered.length} log line(s)`)
    } catch (err) {
      console.error('Copy failed', err)
      toast.error('Copy failed — try long-press → select all')
    }
  }

  function handleClear() {
    clearLogs()
    toast.info('Logs cleared')
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1 bg-ink-800 rounded-full p-1">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition',
              filter === 'all'
                ? 'bg-ink-700 text-ink-50'
                : 'text-ink-400',
            )}
          >
            All ({logs.length})
          </button>
          <button
            onClick={() => setFilter('errors')}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition',
              filter === 'errors'
                ? 'bg-ink-700 text-ink-50'
                : 'text-ink-400',
            )}
          >
            Errors only (
            {logs.filter((l) => l.level === 'error' || l.level === 'warn').length}
            )
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setLogs(getLogs())}
            className="p-1.5 rounded-lg text-ink-300 hover:text-ink-50"
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={copyAll}
            disabled={filtered.length === 0}
            className="p-1.5 rounded-lg text-ink-300 hover:text-ink-50 disabled:opacity-40"
            aria-label="Copy all"
            title="Copy all"
          >
            <Copy size={14} />
          </button>
          <button
            onClick={handleClear}
            disabled={logs.length === 0}
            className="p-1.5 rounded-lg text-ink-400 hover:text-red-400 disabled:opacity-40"
            aria-label="Clear"
            title="Clear"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-700 bg-ink-900/40 px-4 py-8 text-center">
          <Bug size={20} className="text-ink-500 mx-auto mb-2" />
          <p className="text-xs text-ink-400">
            {filter === 'errors'
              ? 'No errors yet. Trigger the bug, then come back here.'
              : 'No log entries yet.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-ink-900 border border-ink-800 max-h-96 overflow-y-auto">
          <ul className="divide-y divide-ink-800/60">
            {filtered.map((e, idx) => (
              <li
                key={idx}
                className={cn(
                  'px-3 py-2 text-[10px] font-mono leading-tight whitespace-pre-wrap break-words',
                  LEVEL_STYLES[e.level],
                )}
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-ink-500 shrink-0">
                    {new Date(e.ts).toISOString().slice(11, 19)}
                  </span>
                  <span className="text-ink-500 shrink-0 uppercase">
                    {e.level}
                  </span>
                </div>
                <div className="mt-0.5">{e.message}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-[10px] text-ink-500 leading-relaxed">
        Captures all console messages, uncaught errors, and unhandled promise
        rejections from the moment the app loads. Stays on this device.
      </p>
    </div>
  )
}
