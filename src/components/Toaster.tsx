import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { useToastStore, type ToastKind } from '@/lib/toast'
import { cn } from '@/lib/utils'

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}

const STYLES: Record<ToastKind, string> = {
  success: 'bg-accent/10 border-accent/30 text-accent',
  error: 'bg-red-500/10 border-red-500/30 text-red-300',
  info: 'bg-ink-800 border-ink-700 text-ink-100',
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed left-0 right-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none"
      style={{ top: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
    >
      {toasts.map((t) => {
        const Icon = ICONS[t.kind]
        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto rounded-xl border px-3 py-2 backdrop-blur-md flex items-center gap-2 max-w-sm shadow-lg',
              STYLES[t.kind],
            )}
          >
            <Icon size={16} className="shrink-0" />
            <span className="text-sm flex-1">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="ml-1 opacity-60 hover:opacity-100"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
