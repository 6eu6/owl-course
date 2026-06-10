import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getCourseBySlug } from '@/lib/queries'

const TELEGRAM_API = 'https://api.telegram.org'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.learn-plus.uk'
const SIGNING_SECRET =
  process.env.BROKEN_REPORT_SECRET ||
  process.env.ADMIN_BOT_TOKEN ||
  process.env.TELEGRAM_BOT_TOKEN ||
  ''

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function adminChatIds(): string[] {
  return (process.env.ADMIN_CHAT_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
}

function signSlug(slug: string): string {
  return crypto.createHmac('sha256', SIGNING_SECRET).update(slug).digest('hex')
}

async function sendAdminAlert(text: string, replyMarkup: Record<string, unknown>): Promise<boolean> {
  const botToken = process.env.ADMIN_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || ''
  const chatIds = adminChatIds()

  if (!botToken || chatIds.length === 0) return false

  const results = await Promise.all(
    chatIds.map(async (chatId) => {
      try {
        const res = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            reply_markup: replyMarkup,
          }),
          signal: AbortSignal.timeout(15000),
        })
        return res.ok
      } catch {
        return false
      }
    }),
  )

  return results.some(Boolean)
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const slug = String(body.slug || '').trim()

    if (!slug) {
      return NextResponse.json({ success: false, error: 'Missing course slug' }, { status: 400 })
    }

    if (!SIGNING_SECRET) {
      return NextResponse.json(
        { success: false, error: 'Broken-link reporting is not configured' },
        { status: 500 },
      )
    }

    const course = await getCourseBySlug(slug)
    if (!course || !course.isPublished) {
      return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 })
    }

    const enrollUrl = `${SITE_URL}/en/course/${course.slug}/enroll`
    const deleteUrl = `${SITE_URL}/api/report-broken/delete?slug=${encodeURIComponent(course.slug)}&token=${signSlug(course.slug)}`

    const message =
      `🚨 <b>Broken Udemy link report</b>\n\n` +
      `<b>Course:</b> ${escapeHtml(course.title)}\n` +
      `<b>Slug:</b> <code>${escapeHtml(course.slug)}</code>\n` +
      `<b>Source:</b> ${escapeHtml(course.source || 'Unknown')}\n\n` +
      `Open the enrol page first. Delete only if the Udemy link is actually broken or no longer free.`

    const sent = await sendAdminAlert(message, {
      inline_keyboard: [
        [{ text: 'زيارة رابط', url: enrollUrl }],
        [{ text: 'حذف الدورة', url: deleteUrl }],
      ],
    })

    if (!sent) {
      return NextResponse.json(
        { success: false, error: 'Failed to notify Telegram admin bot' },
        { status: 502 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[BrokenLinkReport] Error:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
