// ============================================
// ShrinkMe link shortener (monetized outbound links)
// ============================================
//
// When enabled, a configurable fraction of outbound course clicks are routed
// through ShrinkMe (which shows an ad interstitial then redirects to the real
// Udemy link). The frequency is controlled from the Telegram admin panel so it
// can stay light enough not to annoy visitors (e.g. an ad only on every 5th
// click — four clean opens, then one ad).
//
// The decision is made per click in /api/go using a per-visitor cookie counter,
// so it adds NO database writes. The API token lives in the SHRINKME_API_TOKEN
// environment variable (never in the repo).

import { getSetting, setSetting } from './queries'

export interface ShortenerSettings {
  /** Master on/off for ad links. */
  enabled: boolean
  /** Serve an ad link on every Nth outbound click (>=1). 1 = always, 5 = every 5th. */
  everyN: number
}

const DEFAULTS: ShortenerSettings = { enabled: false, everyN: 5 }
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
    return { enabled: !!p.enabled, everyN: clampN(p.everyN) }
  } catch {
    return { ...DEFAULTS }
  }
}

export async function saveShortenerSettings(s: ShortenerSettings): Promise<void> {
  await setSetting(SETTING_KEY, JSON.stringify({ enabled: !!s.enabled, everyN: clampN(s.everyN) }))
}

/** True when the given 1-based click number should be served an ad link. */
export function shouldServeAd(clickNumber: number, s: ShortenerSettings): boolean {
  if (!s.enabled || s.everyN < 1) return false
  return clickNumber % s.everyN === 0
}

/**
 * Shorten a URL via ShrinkMe. The response is cached per URL (Next data cache,
 * 30 days) so repeated ad-clicks for the same course reuse one short link
 * instead of creating new links / calling the API every time. Returns null if
 * no token is configured or the call fails — the caller then uses the direct
 * link, so a shortener outage never blocks a visitor.
 */
export async function shortenUrl(url: string): Promise<string | null> {
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
