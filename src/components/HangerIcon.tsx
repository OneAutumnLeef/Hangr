interface Props {
  className?: string
}

/**
 * Hangr wordmark icon — a clean clothes-hanger glyph.
 * Stroke-based so it scales crisp at any size and inherits `currentColor`.
 */
export function HangerIcon({ className }: Props) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Hook */}
      <path
        d="M32 12 C32 7, 36 5, 39 7 C42 9, 42 13, 39 15 L32 19"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Hanger triangle */}
      <path
        d="M32 19 L9 41 C7.5 42.5, 8 45, 10 45.5 L54 45.5 C56 45, 56.5 42.5, 55 41 L32 19 Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      {/* Cross-bar (subtle, gives it weight) */}
      <line
        x1="11"
        y1="45.5"
        x2="53"
        y2="45.5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}
