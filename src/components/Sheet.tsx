import { type ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}

/** Bottom-sheet modal. Tap backdrop to close. */
export function Sheet({ open, onClose, title, children, footer }: Props) {
  // Lock body scroll while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-ink-950/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mt-auto bg-ink-900 border-t border-ink-800 rounded-t-3xl flex flex-col max-h-[90dvh]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-3">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-ink-700 mb-3" />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 border-b border-ink-800">
          <h2 className="font-semibold text-lg">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 -mr-1 rounded-lg text-ink-400 hover:text-ink-50"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <div className="border-t border-ink-800 p-4">{footer}</div>
        )}
      </div>
    </div>
  )
}
