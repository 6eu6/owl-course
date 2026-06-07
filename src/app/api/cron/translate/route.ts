import { NextResponse } from 'next/server'
import { normalizeLocale } from '@/lib/i18n'
import { processTranslationBatch } from '@/lib/course-translations'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('secret') || ''
    const expected = process.env.CRON_SECRET || process.env.ADMIN_PASSWORD || ''

    if (expected && secret !== expected) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const locale = normalizeLocale(searchParams.get('locale') || 'ar')
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '5'), 1), 10)

    // Arabic needs a translation provider key. Fail fast with a clear message
    // instead of marking every course as failed in the database.
    if (locale === 'ar' && !(process.env.TRANSLATION_API_KEY || process.env.OPENAI_API_KEY)) {
      return NextResponse.json(
        { success: false, locale, processed: 0, error: 'Missing TRANSLATION_API_KEY or OPENAI_API_KEY' },
        { status: 400 }
      )
    }

    const startedAt = Date.now()
    const result = await processTranslationBatch(locale, limit)

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
