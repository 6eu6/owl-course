'use client'

import { useState } from 'react'

// Share the course (its info-page URL) to any app, plus a copy-link button.
// Uses the native share sheet when available, with explicit app fallbacks.
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false)

  const shareText = `${title} — Free on Learn Plus Courses`
  const enc = encodeURIComponent
  const targets: { label: string; href: string }[] = [
    { label: 'WhatsApp', href: `https://wa.me/?text=${enc(shareText + ' ' + url)}` },
    { label: 'Telegram', href: `https://t.me/share/url?url=${enc(url)}&text=${enc(shareText)}` },
    { label: 'X', href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(shareText)}` },
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
  ]

  async function nativeShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text: shareText, url })
      } catch {
        /* user cancelled */
      }
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="mb-2 text-[11px] font-semibold text-muted-foreground">Share this course</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={copyLink}
          className="rounded-md border px-3 py-1.5 text-[11px] font-medium hover:bg-muted transition-colors"
        >
          {copied ? 'Copied ✓' : 'Copy link'}
        </button>
        <button
          onClick={nativeShare}
          className="rounded-md border px-3 py-1.5 text-[11px] font-medium hover:bg-muted transition-colors"
        >
          Share…
        </button>
        {targets.map((t) => (
          <a
            key={t.label}
            href={t.href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border px-3 py-1.5 text-[11px] font-medium hover:bg-muted transition-colors"
          >
            {t.label}
          </a>
        ))}
      </div>
    </div>
  )
}
