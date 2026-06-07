'use client'

import { useEffect, useState } from 'react'

// Shows a "preparing…" state with a countdown + progress bar for `seconds`,
// then reveals the action button. Keeps the visitor on our page a little
// longer before the button (internal link or final Udemy link) appears.
export function TimedReveal({
  seconds,
  loadingText,
  buttonText,
  href,
  external = false,
}: {
  seconds: number
  loadingText: string
  buttonText: string
  href: string
  external?: boolean
}) {
  const [remaining, setRemaining] = useState(seconds)

  useEffect(() => {
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(t)
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [])

  if (remaining > 0) {
    const pct = Math.round(((seconds - remaining) / seconds) * 100)
    return (
      <div className="w-full rounded-lg border bg-card p-4 text-center space-y-3">
        <div className="flex items-center justify-center gap-2 text-sm font-medium">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
          <span>{loadingText}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-foreground transition-all duration-1000 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">Please wait {remaining}s…</p>
      </div>
    )
  }

  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-green-700"
    >
      {buttonText}
    </a>
  )
}
