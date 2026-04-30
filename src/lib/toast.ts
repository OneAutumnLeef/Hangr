import { create } from 'zustand'
import { makeId } from './utils'

export type ToastKind = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  message: string
  kind: ToastKind
  durationMs: number
}

interface ToastStore {
  toasts: Toast[]
  show: (
    message: string,
    opts?: { kind?: ToastKind; durationMs?: number },
  ) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  show: (message, opts = {}) => {
    const id = makeId('toast')
    const t: Toast = {
      id,
      message,
      kind: opts.kind ?? 'success',
      durationMs: opts.durationMs ?? 2400,
    }
    set((s) => ({ toasts: [...s.toasts, t] }))
    setTimeout(() => get().dismiss(id), t.durationMs)
  },
  dismiss: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))

/** Convenience helper — `toast.success('Saved')`. */
export const toast = {
  success: (msg: string) =>
    useToastStore.getState().show(msg, { kind: 'success' }),
  error: (msg: string) =>
    useToastStore.getState().show(msg, { kind: 'error' }),
  info: (msg: string) => useToastStore.getState().show(msg, { kind: 'info' }),
}
