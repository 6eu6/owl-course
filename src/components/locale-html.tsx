'use client'

import { useEffect } from 'react'

// Syncs <html lang/dir> for localized routes. The root layout renders
// <html lang="en" dir="ltr">; nested layouts cannot change those attributes
// server-side, so we update them on the client for correct RTL + a11y/SEO.
export function LocaleHtml({ locale, dir }: { locale: string; dir: 'ltr' | 'rtl' }) {
  useEffect(() => {
    const el = document.documentElement
    const prevLang = el.lang
    const prevDir = el.dir
    el.lang = locale
    el.dir = dir
    return () => {
      el.lang = prevLang || 'en'
      el.dir = prevDir || 'ltr'
    }
  }, [locale, dir])
  return null
}
