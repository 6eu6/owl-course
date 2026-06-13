import { NextResponse } from 'next/server'
import { normalizeLocale } from '@/lib/i18n'
import { processTranslationBatch } from '@/lib/course-translations'
import { revalidateCourses } from '@/lib/cache'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret') || ''
    const expected = process.env.CRON_SECRET || process.env.ADMIN_PASSWORD || ''

    if (expected && secret !== expected) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const locale = normalizeLocale(searchParams.get('locale') || 'ar')
    // Generation is instant and cannot fail, so a single tick can drain a far
    // larger batch than the old per-call AI translation allowed.
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20'), 1), 50)

    // English needs no translation step: /en and English Telegram read the
    // scraped Course rows directly. Keep the route for backward compatibility
    // but make it a no-op so the scheduler can drop the translate-en call.
    if (locale === 'en') {
      return NextResponse.json({
        success: true,
        locale: 'en',
        processed: 0,
        results: [],
        message: 'English uses source Course rows — no translation needed',
        timestamp: new Date().toISOString(),
      })
    }

    // Arabic no longer calls any translation provider — the Arabic rows are
    // generated locally from the category-aware bank, so no API key is required.

    const startedAt = Date.now()
    const result = await processTranslationBatch(locale, limit)

    // Newly translated Arabic rows change the /ar listing → refresh its cache.
    if (result.processed > 0) {
      revalidateCourses()
    }

    return NextResponse.json({
      success: true,
      locale,
      processed: result.processed,
      results: result.results,
      durationMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
