import { NextResponse } from 'next/server';
import { normalizeLocale } from '@/lib/i18n';
import { db } from '@/lib/db';
import { regenerateArabicTranslations } from '@/lib/course-translations';
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
  // Arabic bank as one batched delete+createMany, so a large window is cheap
  // (lets the whole set be unified in a single call).
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50'), 1), 2000);

  try {
    // Regenerate a window of existing Arabic rows, oldest-touched first.
    const candidates = await (db as any).courseTranslation.findMany({
      where: { locale: 'ar', course: { isPublished: true } },
      include: { course: true },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });

    // Regenerate the whole window in one batched operation (delete + createMany).
    const courses = (candidates as any[]).map((tr) => tr.course).filter(Boolean);
    const processed = await regenerateArabicTranslations(courses);

    if (processed > 0) revalidateCourses();

    return NextResponse.json({
      success: true,
      locale: 'ar',
      processed,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
