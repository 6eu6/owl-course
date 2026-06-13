import { NextResponse, type NextRequest } from 'next/server'
import { getShortenerSettings, shouldServeAd, shortenUrl } from '@/lib/shortener'

export const dynamic = 'force-dynamic'

const COOKIE = 'lpc_go'
const YEAR = 60 * 60 * 24 * 365

// Only ever redirect to Udemy — prevents this endpoint being abused as an open
// redirector.
function isUdemy(u: string): boolean {
  try {
    const h = new URL(u).hostname.toLowerCase()
    return h === 'udemy.com' || h.endsWith('.udemy.com')
  } catch {
    return false
  }
}

// GET /api/go?u=<udemy url>
// Decides, per visitor, whether this outbound click goes direct or through the
// (ad-bearing) ShrinkMe link, based on the admin frequency setting. The count is
// kept in a cookie, so there are no database writes per click.
export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get('u') || ''
  if (!isUdemy(u)) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  const settings = await getShortenerSettings()

  // Disabled → straight to Udemy, no cookie churn.
  if (!settings.enabled) {
    return NextResponse.redirect(u)
  }

  const current = parseInt(req.cookies.get(COOKIE)?.value || '0', 10)
  const clickNumber = (Number.isFinite(current) ? current : 0) + 1

  let dest = u
  if (shouldServeAd(clickNumber, settings)) {
    const short = await shortenUrl(u)
    if (short) dest = short
  }

  const res = NextResponse.redirect(dest)
  res.cookies.set(COOKIE, String(clickNumber), {
    maxAge: YEAR,
    sameSite: 'lax',
    path: '/',
  })
  return res
}
