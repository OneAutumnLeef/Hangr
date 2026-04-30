import { useEffect } from 'react'
import { create } from 'zustand'

/**
 * Shell-level UI state. Tracks how many blocking overlays (sheets, confirm
 * dialogs) are currently open so chrome like the floating TabBar can step
 * out of the way — the capsule nav otherwise sits over sheet footers and
 * action bars and blocks the primary CTAs.
 *
 * Increment on overlay open, decrement on close. Never let it go negative;
 * StrictMode mounts effects twice in dev which can otherwise produce
 * mismatched push/pop counts if not guarded.
 */
interface ShellState {
  overlayCount: number
  pushOverlay: () => void
  popOverlay: () => void
}

export const useShell = create<ShellState>((set) => ({
  overlayCount: 0,
  pushOverlay: () => set((s) => ({ overlayCount: s.overlayCount + 1 })),
  popOverlay: () =>
    set((s) => ({ overlayCount: Math.max(0, s.overlayCount - 1) })),
}))

/**
 * Tell the shell that a blocking overlay is mounted while `active` is true.
 * Use from any modal-style component (Sheet, confirm dialog) so the TabBar
 * fades out for the duration.
 */
export function useOverlay(active: boolean) {
  const pushOverlay = useShell((s) => s.pushOverlay)
  const popOverlay = useShell((s) => s.popOverlay)
  useEffect(() => {
    if (!active) return
    pushOverlay()
    return () => popOverlay()
  }, [active, pushOverlay, popOverlay])
}
