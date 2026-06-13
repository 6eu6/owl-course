// ============================================
// Link shortener — two modes
// ============================================
//
//   off   → links stay direct (no shortening, no ads).
//   clean → links are shortened via is.gd (a free, no-ads, no-key shortener).
//           Use this to ship short links now WITHOUT showing visitors any ads.
//   ads   → links go through ShrinkMe (shows an ad page, then redirects), which
//           is how it earns. On the website an ad link is served only on every
//           Nth click (the rest direct) so it never annoys; Telegram posts use
//           the shortened link directly.
//
// In both clean and ads modes the link posted to Telegram is the shortened one.
// ShrinkMe needs SHRINKME_API_TOKEN in the environment; if it is missing the
// code falls back to the direct link so nothing ever breaks.

import { getSetting, setSetting } from './queries'

export type ShortenerMode = 'off' | 'clean' | 'ads'

export interface ShortenerSettings {
  mode: ShortenerMode
  /** In 'ads' mode: serve an ad link on every Nth website click (>=1). */
  everyN: number
}

const DEFAULTS: ShortenerSettings = { mode: 'off', everyN: 5 }
const SETTING_KEY = 'shortener'

function clampN(n: unknown): number {
  const v = parseInt(String(n), 10)
  if (!Number.isFinite(v)) return DEFAULTS.everyN
  return Math.min(Math.max(v, 1), 100)
}

export async function getShortenerSettings(): Promise<ShortenerSettings> {
  const raw = await getSetting(SETTING_KEY)
  if (!raw) return { ...DEFAULTS }
  try {
    const p = JSON.parse(raw)
    let mode: ShortenerMode =
      p.mode === 'clean' || p.mode === 'ads' || p.mode === 'off'
        ? p.mode
        : p.enabled // back-compat with the earlier {enabled,everyN} shape
        ? 'ads'
        : 'off'
    return { mode, everyN: clampN(p.everyN) }
  } catch {
    return { ...DEFAULTS }
  }
}

export async function saveShortenerSettings(s: ShortenerSettings): Promise<void> {
  const mode: ShortenerMode = s.mode === 'clean' || s.mode === 'ads' ? s.mode : 'off'
  await setSetting(SETTING_KEY, JSON.stringify({ mode, everyN: clampN(s.everyN) }))
}

/** True when the given 1-based click number should be served an ad link (ads mode only). */
export function shouldServeAd(clickNumber: number, s: ShortenerSettings): boolean {
  if (s.mode !== 'ads' || s.everyN < 1) return false
  return clickNumber % s.everyN === 0
}

// --- Providers (each cached per URL for 30 days via the Next data cache, so a
// link is created once and reused — no new short link / API call per click) ---

async function viaIsGd(url: string): Promise<string | null> {
  try {
    const api = `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`
    const res = await fetch(api, { next: { revalidate: 60 * 60 * 24 * 30 } })
    if (!res.ok) return null
    const text = (await res.text()).trim()
    return /^https?:\/\//i.test(text) ? text : null
  } catch {
    return null
  }
}

async function viaShrinkMe(url: string): Promise<string | null> {
  const token = (process.env.SHRINKME_API_TOKEN || '').trim()
  if (!token) return null
  try {
    const api = `https://shrinkme.io/api?api=${encodeURIComponent(token)}&url=${encodeURIComponent(url)}&format=text`
    const res = await fetch(api, { next: { revalidate: 60 * 60 * 24 * 30 } })
    if (!res.ok) return null
    const text = (await res.text()).trim()
    return /^https?:\/\//i.test(text) ? text : null
  } catch {
    return null
  }
}

/** Shorten with the provider for the given mode. Returns null on failure/off. */
export async function shortenByMode(url: string, mode: ShortenerMode): Promise<string | null> {
  if (mode === 'clean') return viaIsGd(url)
  if (mode === 'ads') return viaShrinkMe(url)
  return null
}

/** Telegram-posted links are always shortened when the shortener is enabled. */
export async function shortenForShare(url: string): Promise<string> {
  const s = await getShortenerSettings()
  if (s.mode === 'off') return url
  return (await shortenByMode(url, s.mode)) || url
}
