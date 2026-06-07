import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'

const SIGNING_SECRET =
  process.env.BROKEN_REPORT_SECRET ||
  process.env.ADMIN_BOT_TOKEN ||
  process.env.TELEGRAM_BOT_TOKEN ||
  ''

function signSlug(slug: string): string {
  return crypto.createHmac('sha256', SIGNING_SECRET).update(slug).digest('hex')
}

function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = String(searchParams.get('slug') || '').trim()
    const token = String(searchParams.get('token') || '').trim()

    if (!SIGNING_SECRET) {
      return new NextResponse('Delete link is not configured.', { status: 500 })
    }

    if (!slug || !safeEqual(token, signSlug(slug))) {
      return new NextResponse('Invalid or expired delete link.', { status: 403 })
    }

    const course = await db.course.findUnique({ where: { slug } })
    if (!course) {
      return new NextResponse('Course was not found or was already deleted.', { status: 404 })
    }

    await db.course.delete({ where: { id: course.id } })

    return new NextResponse(
      `Course deleted permanently: ${course.title}`,
      { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    )
  } catch (error) {
    console.error('[BrokenLinkDelete] Error:', error)
    return new NextResponse(`Delete failed: ${String(error)}`, { status: 500 })
  }
}
