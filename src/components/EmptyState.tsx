import { type ReactNode } from 'react'

interface Props {
  icon?: ReactNode
  title: string
  message: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      {icon && <div className="mb-6 text-ink-500">{icon}</div>}
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-ink-400 max-w-xs leading-relaxed">
        {message}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-6 px-5 py-2.5 rounded-full bg-accent text-ink-950 font-medium active:scale-95 transition"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
