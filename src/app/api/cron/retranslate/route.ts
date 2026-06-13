import { NextResponse } from 'next/server';
import { normalizeLocale } from '@/lib/i18n';
import { db } from '@/lib/db';
import { translateCourseToArabic } from '@/lib/course-translations';
import { revalidateCourses } from '@/lib/cache';

// =============================================================================
// Arabic regenerate endpoint — Learn Plus Courses
// -----------------------------------------------------------------------------
// Re-generates the Arabic rows (oldest first) from the category-aware Arabic
// bank. Useful after the bank is expanded so existing rows pick up the richer
// copy. No AI/provider, instant, cannot fail.
//
// Does NOT touch English translations, does NOT touch Course rows, does NOT post.
//
// GET /api/cron/retranslate?secret=CRON_SECRET&locale=ar&limit=20
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
  // No translation provider key needed: rows are regenerated locally from the
  // Arabic bank. The window is larger since regeneration is instant and cannot fail.
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '5'), 1), 50);

  try {
    // Regenerate a window of existing Arabic rows, oldest-touched first.
    const candidates = await (db as any).courseTranslation.findMany({
      where: { locale: 'ar', course: { isPublished: true } },
      include: { course: true },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });

    const results: Array<{ courseId: string; title: string; status: string; error?: string }> = [];
    const startedAt = Date.now();

    for (const tr of candidates as any[]) {
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

    if (results.some((r) => r.status === 'translated')) revalidateCourses();

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
