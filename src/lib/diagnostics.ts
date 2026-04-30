/**
 * In-app diagnostic logger.
 *
 * Captures everything that happens at runtime so we can debug iOS-specific
 * issues without a Mac + USB cable + Safari Web Inspector.
 *
 * Hooks:
 *   - All console.{log,info,warn,error} calls
 *   - window 'error' events (synchronous throws not caught by React)
 *   - window 'unhandledrejection' events (rejected promises)
 *   - Service-worker registration/update events
 *
 * The ring buffer holds the last 500 entries; older ones drop. The whole
 * buffer is mirrored to localStorage on every write, so logs survive
 * page reloads (critical when the bug we're chasing causes a reload).
 *
 * Privacy: this is local-only. No network calls. Entries live in this
 * device's localStorage and nowhere else.
 */

export type LogLevel = 'log' | 'info' | 'warn' | 'error'

export interface LogEntry {
  ts: number
  level: LogLevel
  message: string
}

const MAX_ENTRIES = 500
const STORAGE_KEY = 'hangr.diag.v1'

let entries: LogEntry[] = []
let installed = false
let listeners: Array<() => void> = []

function safeStringify(v: unknown): string {
  if (typeof v === 'string') return v
  if (v instanceof Error) {
    const stack = v.stack ? `\n${v.stack}` : ''
    return `${v.name}: ${v.message}${stack}`
  }
  if (typeof v === 'undefined') return 'undefined'
  if (v === null) return 'null'
  try {
    return JSON.stringify(v, replacer, 2)
  } catch {
    try {
      return String(v)
    } catch {
      return '[unserializable]'
    }
  }
}

// Drop Blobs, Files, large arrays, etc. — we don't want to spam the buffer.
function replacer(_key: string, value: unknown) {
  if (value instanceof Blob) return `[Blob ${value.size} bytes ${value.type}]`
  if (value instanceof ArrayBuffer)
    return `[ArrayBuffer ${value.byteLength} bytes]`
  if (
    typeof value === 'object' &&
    value !== null &&
    'constructor' in value &&
    (value.constructor === Uint8Array ||
      value.constructor === Float32Array ||
      value.constructor === Int32Array)
  ) {
    return `[${(value.constructor as { name: string }).name} ${(value as { length: number }).length}]`
  }
  return value
}

function joinArgs(args: unknown[]): string {
  return args.map(safeStringify).join(' ')
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Quota — drop the oldest half and try again.
    entries = entries.slice(-Math.floor(MAX_ENTRIES / 2))
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch {
      /* give up */
    }
  }
}

function notify() {
  for (const l of listeners) l()
}

function append(level: LogLevel, args: unknown[]) {
  entries.push({
    ts: Date.now(),
    level,
    message: joinArgs(args),
  })
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES)
  }
  persist()
  notify()
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) entries = parsed
    }
  } catch {
    /* ignore */
  }
}

export function installDiagnostics(): void {
  if (installed) return
  installed = true
  if (typeof window === 'undefined') return

  loadFromStorage()

  // Patch console — keep originals working so devtools still get them.
  const orig: Record<LogLevel, (...args: unknown[]) => void> = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  }
  console.log = (...args: unknown[]) => {
    append('log', args)
    orig.log(...args)
  }
  console.info = (...args: unknown[]) => {
    append('info', args)
    orig.info(...args)
  }
  console.warn = (...args: unknown[]) => {
    append('warn', args)
    orig.warn(...args)
  }
  console.error = (...args: unknown[]) => {
    append('error', args)
    orig.error(...args)
  }

  window.addEventListener('error', (e) => {
    append('error', [
      `[window.onerror] ${e.message}`,
      `at ${e.filename ?? '?'}:${e.lineno ?? '?'}:${e.colno ?? '?'}`,
      e.error,
    ])
  })

  window.addEventListener('unhandledrejection', (e) => {
    append('error', ['[unhandledrejection]', e.reason])
  })

  // Useful environment info on every install
  append('info', ['---'])
  append('info', [`Diagnostics installed @ ${new Date().toISOString()}`])
  append('info', [`UA: ${navigator.userAgent}`])
  append('info', [
    `Standalone (PWA): ${window.matchMedia('(display-mode: standalone)').matches}`,
  ])
  const navStandalone = (
    window.navigator as Navigator & { standalone?: boolean }
  ).standalone
  if (navStandalone !== undefined) {
    append('info', [`iOS navigator.standalone: ${navStandalone}`])
  }
  append('info', [
    `WebGPU available: ${'gpu' in (navigator as Navigator & { gpu?: unknown })}`,
  ])
  append('info', [
    `SharedArrayBuffer: ${typeof SharedArrayBuffer !== 'undefined'}`,
  ])
  append('info', [`crossOriginIsolated: ${window.crossOriginIsolated}`])
  if (navigator.storage?.estimate) {
    navigator.storage
      .estimate()
      .then((est) => {
        append('info', [
          `Storage: ${Math.round((est.usage ?? 0) / 1024 / 1024)} / ${Math.round(
            (est.quota ?? 0) / 1024 / 1024,
          )} MB`,
        ])
      })
      .catch(() => {})
  }
}

export function getLogs(): LogEntry[] {
  return [...entries]
}

export function clearLogs(): void {
  entries = []
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
  notify()
}

export function subscribe(listener: () => void): () => void {
  listeners.push(listener)
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

/** Format a single entry as a single line. Useful for copy-all. */
export function formatEntry(e: LogEntry): string {
  const t = new Date(e.ts).toISOString().slice(11, 23) // HH:mm:ss.sss
  return `[${t}] [${e.level.toUpperCase()}] ${e.message}`
}

export function formatAll(entriesToFormat: LogEntry[]): string {
  return entriesToFormat.map(formatEntry).join('\n')
}
