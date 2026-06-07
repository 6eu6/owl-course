'use client'

import { useState } from 'react'

export function ReportBrokenLinkButton({
  slug,
  title,
}: {
  slug: string
  title: string
}) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function reportBrokenLink() {
    if (status === 'sending' || status === 'sent') return
    setStatus('sending')

    try {
      const res = await fetch('/api/report-broken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, title }),
      })

      if (!res.ok) throw new Error('Report failed')
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  const label =
    status === 'sending'
      ? 'Reporting broken link...'
      : status === 'sent'
        ? 'Broken link reported'
        : status === 'error'
          ? 'Try reporting again'
          : 'Report broken link'

  return (
    <button
      type="button"
      onClick={reportBrokenLink}
      disabled={status === 'sending' || status === 'sent'}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
      aria-live="polite"
    >
      {status === 'sending' ? '⏳' : status === 'sent' ? '✅' : null}
      {label}
    </button>
  )
}
