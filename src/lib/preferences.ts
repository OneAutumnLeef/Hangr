import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * iOS Safari kills tabs that hold too much memory. RMBG-1.4 (~150MB) plus
 * CLIP (~80MB) easily exceeds the threshold on iPhones, causing the page to
 * blank-and-reload. So ML defaults OFF on iOS, ON elsewhere.
 *
 * Users can override in Settings.
 */
function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  // iPhone, iPad, iPod (and iPad-as-Mac in newer iOS reports Mac UA + touch)
  if (/iPad|iPhone|iPod/.test(ua)) return true
  // iPadOS 13+ reports as Mac. Detect via touch + Mac UA combination.
  if (
    /Macintosh/.test(ua) &&
    typeof document !== 'undefined' &&
    'ontouchend' in document
  ) {
    return true
  }
  return false
}

export const isIOS = detectIOS()

interface PrefsState {
  /** When true, run background removal + auto-detection on capture. */
  mlEnabled: boolean
  setMlEnabled: (v: boolean) => void
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      // Default ON for desktop browsers; OFF for iOS to avoid memory-pressure
      // tab kills. Users can flip the switch in Settings.
      mlEnabled: !isIOS,
      setMlEnabled: (v) => set({ mlEnabled: v }),
    }),
    {
      name: 'hangr-prefs',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
)
