import { NextResponse } from 'next/server';
import { normalizeLocale } from '@/lib/i18n';
import { db } from '@/lib/db';
import { translateCourseToArabic, validateArabicEditorialQuality } from '@/lib/course-translations';

// =============================================================================
// Arabic retranslate endpoint — Learn Plus Courses
// -----------------------------------------------------------------------------
// Re-runs the Arabic translation for rows that are technically status='translated'
// or 'failed' but stylistically bad (e.g. they contain CJK/garbled characters or
// machine-translated phrasing). Rows that fail the editorial quality gate are
// prioritised. Improves Arabic WITHOUT deleting Course rows.
//
// Does NOT touch English translations, does NOT touch Course rows, does NOT post.
//
// GET /api/cron/retranslate?secret=CRON_SECRET&locale=ar&limit=5
// =============================================================================
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret') || '';
  const expected = process.env.CRON_SECRET || process.env.ADMIN_PASSWORD || '';
  if (expected && secret !== expected) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const locale = normalizeLocale(searchParams.get('locale') || 'ar');
  if (locale !== 'ar') {
    return NextResponse.json({ success: false, error: 'retranslate only supports locale=ar' }, { status: 400 });
  }
  if (!(process.env.TRANSLATION_API_KEY || process.env.OPENAI_API_KEY)) {
    return NextResponse.json({ success: false, error: 'Missing TRANSLATION_API_KEY or OPENAI_API_KEY' }, { status: 400 });
  }

  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '5'), 1), 10);

  try {
    // Pull a window of existing Arabic rows, oldest-touched first.
    const candidates = await (db as any).courseTranslation.findMany({
      where: { locale: 'ar', status: { in: ['translated', 'failed'] }, course: { isPublished: true } },
      include: { course: true },
      orderBy: { updatedAt: 'asc' },
      take: Math.max(limit * 5, limit),
    });

    // Prioritise rows that fail the editorial quality gate (bad Arabic first).
    const ranked = (candidates as any[])
      .map((r) => ({
        row: r,
        bad: validateArabicEditorialQuality({
          title: r.title || '',
          description: r.description || '',
          requirements: r.requirements || '',
          whoFor: r.whoFor || '',
          whatLearn: r.whatLearn || '',
          category: r.category || '',
          metaTitle: r.metaTitle || '',
          metaDescription: r.metaDescription || '',
        }).length > 0,
      }))
      .sort((a, b) => Number(b.bad) - Number(a.bad));

    const selected = ranked.slice(0, limit).map((x) => x.row);

    const results: Array<{ courseId: string; title: string; status: string; error?: string }> = [];
    const startedAt = Date.now();

    for (const tr of selected) {
      const course = tr.course;
      if (!course) continue;
      // Stay within the serverless time budget; the rest are picked up next call.
      if (Date.now() - startedAt > 45_000) break;
      try {
        await translateCourseToArabic(course);
        results.push({ courseId: course.id, title: course.title, status: 'translated' });
      } catch (err) {
        results.push({ courseId: course.id, title: course.title, status: 'failed', error: String(err).slice(0, 220) });
      }
    }

    return NextResponse.json({
      success: true,
      locale: 'ar',
      processed: results.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
