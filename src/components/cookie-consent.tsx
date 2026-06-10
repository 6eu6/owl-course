'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const KEY = 'lp-cookie-consent'

type Consent = { necessary: true; analytics: boolean; ts: number }

// Minimal, on-brand cookie banner. Stores the choice locally (no account, no
// server round-trip) so visitors are never blocked behind logins.
export function CookieConsent() {
  const [open, setOpen] = useState(false)
  const [customize, setCustomize] = useState(false)
  const [analytics, setAnalytics] = useState(true)

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true)
    } catch {
      /* storage blocked — show banner */
      setOpen(true)
    }
  }, [])

  function save(consent: Consent) {
    try {
      localStorage.setItem(KEY, JSON.stringify(consent))
    } catch {
      /* ignore */
    }
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] border-t bg-background/95 backdrop-blur-md">
      <div className="mx-auto max-w-3xl px-4 py-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          We use cookies to keep the site working and to understand how it is used. You can
          accept all, reject optional cookies, or choose what to allow. See our{' '}
          <Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
        </p>

        {customize && (
          <div className="mt-3 space-y-2 rounded-lg border bg-card p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium">Necessary</span>
              <span className="text-muted-foreground">Always on</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">Analytics</span>
              <button
                onClick={() => setAnalytics((a) => !a)}
                className={`rounded-md border px-3 py-1 ${analytics ? 'bg-foreground text-background' : 'bg-transparent'}`}
              >
                {analytics ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => save({ necessary: true, analytics: true, ts: Date.now() })}
            className="rounded-md bg-foreground px-4 py-1.5 text-xs font-bold text-background hover:opacity-90"
          >
            Accept all
          </button>
          <button
            onClick={() => save({ necessary: true, analytics: false, ts: Date.now() })}
            className="rounded-md border px-4 py-1.5 text-xs font-medium hover:bg-muted"
          >
            Reject optional
          </button>
          {customize ? (
            <button
              onClick={() => save({ necessary: true, analytics, ts: Date.now() })}
              className="rounded-md border px-4 py-1.5 text-xs font-medium hover:bg-muted"
            >
              Save choices
            </button>
          ) : (
            <button
              onClick={() => setCustomize(true)}
              className="rounded-md border px-4 py-1.5 text-xs font-medium hover:bg-muted"
            >
              Customize
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
