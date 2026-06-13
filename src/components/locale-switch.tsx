'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Languages } from 'lucide-react'
import type { Locale } from '@/lib/i18n'

// Header language toggle. The site is fully localized under /[locale]; switching
// swaps the leading /en or /ar path segment so the user stays on the same page
// in the other language. Course pages whose slug differs per locale are handled
// by the existing per-locale slug redirects. Pages without a locale prefix fall
// back to the other locale's home.
export function LocaleSwitch({ locale }: { locale: Locale }) {
  const pathname = usePathname()
  const other: Locale = locale === 'ar' ? 'en' : 'ar'
  const swapped = (pathname || `/${locale}`).replace(/^\/(en|ar)(?=\/|$)/, `/${other}`)
  const href = swapped.startsWith(`/${other}`) ? swapped : `/${other}`
  const label = other === 'ar' ? 'العربية' : 'English'

  return (
    <Link
      href={href}
      hrefLang={other}
      aria-label={`Switch language to ${label}`}
      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Languages className="h-3.5 w-3.5" />
      <span>{label}</span>
    </Link>
  )
}
