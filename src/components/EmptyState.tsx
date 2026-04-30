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
      {icon && <div className="mb-6 text-tertiary">{icon}</div>}
      <h2 className="font-display text-2xl font-medium text-ink-50 tracking-tight">
        {title}
      </h2>
      <p className="mt-2 text-[15px] text-ink-300 max-w-xs leading-relaxed">
        {message}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-7 px-5 py-2.5 rounded-full bg-accent text-ink-950 font-medium text-sm active:scale-95 transition-transform"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
