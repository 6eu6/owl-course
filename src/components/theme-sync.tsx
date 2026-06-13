'use client'

import { useEffect } from 'react'

// When the browser restores a page from its back/forward cache (bfcache), it
// reuses the old DOM snapshot — including the stale theme class on <html> — and
// does NOT re-run next-themes' init script. So after changing the theme on one
// page and pressing the browser Back button, the restored page could show the
// previous theme. This re-applies the saved theme on bfcache restore so the
// chosen dark/light mode is always preserved.
export function ThemeSync() {
  useEffect(() => {
    const apply = () => {
      try {
        const stored = localStorage.getItem('theme') // 'light' | 'dark' | 'system' | null
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        const isDark = stored === 'dark' || (stored === 'system' && systemDark)
        document.documentElement.classList.toggle('dark', isDark)
      } catch {
        /* storage blocked — leave as-is */
      }
    }
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) apply()
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])
  return null
}
