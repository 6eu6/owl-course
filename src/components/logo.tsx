// Learn Plus brand mark.
// A rounded square (the "card"/course) with a plus cut out of it — the plus
// nods to "Plus" and to "adding" knowledge. It is drawn with `currentColor`
// and an evenodd hole, so it inherits the surrounding text colour and adapts
// to light/dark automatically (black mark on white, white mark on black).

export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="currentColor"
      role="img"
      aria-label="Learn Plus"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7 0H25A7 7 0 0 1 32 7V25A7 7 0 0 1 25 32H7A7 7 0 0 1 0 25V7A7 7 0 0 1 7 0ZM13.4 7.5V13.4H7.5V18.6H13.4V24.5H18.6V18.6H24.5V13.4H18.6V7.5H13.4Z"
      />
    </svg>
  )
}

// Mark + wordmark lockup ("logo with text beside it"), used in headers/footer.
export function Logo({
  className = '',
  markClassName = 'h-6 w-6',
  textClassName = 'text-sm',
}: {
  className?: string
  markClassName?: string
  textClassName?: string
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className={markClassName} />
      <span className={`font-bold tracking-tight ${textClassName}`}>
        Learn<span className="text-muted-foreground"> Plus</span>
      </span>
    </span>
  )
}
