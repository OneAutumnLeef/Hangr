import { useEffect, useState } from 'react'
import { Share, Plus, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'hangr.install-dismissed-at'
const DISMISS_FOR_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

function recentlyDismissed() {
  try {
    const ts = localStorage.getItem(DISMISSED_KEY)
    if (!ts) return false
    return Date.now() - Number(ts) < DISMISS_FOR_MS
  } catch {
    return false
  }
}

function dismiss() {
  try {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  )
  const [installed, setInstalled] = useState(false)
  const [hidden, setHidden] = useState(recentlyDismissed())

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed || hidden) return null

  // Already running as installed PWA — nothing to prompt.
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      // iOS-specific
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true)
  if (isStandalone) return null

  // Android / desktop Chrome path — has the install event.
  if (deferred) {
    return (
      <div className="fixed bottom-24 left-4 right-4 mx-auto max-w-sm z-40 rounded-2xl bg-ink-800/80 border border-ink-700 backdrop-blur-md flex items-center justify-between gap-3 px-4 py-3">
        <div className="text-sm text-ink-100">Add Hangr to your home screen</div>
        <div className="flex items-center gap-1">
          <button
            onClick={async () => {
              await deferred.prompt()
              await deferred.userChoice
              setDeferred(null)
            }}
            className="px-3 py-1.5 rounded-lg bg-accent text-ink-950 text-sm font-medium active:scale-95 transition"
          >
            Install
          </button>
          <button
            onClick={() => {
              dismiss()
              setHidden(true)
            }}
            aria-label="Dismiss"
            className="p-1.5 rounded-lg text-ink-300 hover:text-ink-50"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    )
  }

  // iOS Safari path — no install event; show a hint with the share-icon recipe.
  const isIOS =
    typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent)

  if (isIOS) {
    return (
      <div className="fixed bottom-24 left-4 right-4 mx-auto max-w-sm z-40 rounded-2xl bg-ink-800/80 border border-ink-700 backdrop-blur-md px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm text-ink-100 leading-snug">
            Install Hangr: tap{' '}
            <Share
              size={14}
              className="inline-block align-text-bottom mx-0.5"
            />{' '}
            <span className="font-medium">Share</span>, then{' '}
            <Plus size={14} className="inline-block align-text-bottom mx-0.5" />{' '}
            <span className="font-medium">Add to Home Screen</span>.
          </div>
          <button
            onClick={() => {
              dismiss()
              setHidden(true)
            }}
            aria-label="Dismiss"
            className="p-1 -mr-1 rounded-lg text-ink-400 hover:text-ink-50"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    )
  }

  return null
}
