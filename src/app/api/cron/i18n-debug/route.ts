import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PUBLISHABLE_STATUSES } from '@/lib/course-translations';

// =============================================================================
// i18n debug endpoint — Learn Plus Courses
// -----------------------------------------------------------------------------
// Helps verify slug decoding and translation lookup. Does not expose secrets.
//
// GET /api/cron/i18n-debug?secret=CRON_SECRET&locale=ar&slug=<encoded-or-raw>
// =============================================================================

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret') || '';
  const expected = process.env.CRON_SECRET || process.env.ADMIN_PASSWORD || '';

  if (expected && secret !== expected) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const inputSlug = searchParams.get('slug') || '';
  const locale = searchParams.get('locale') || 'en';
  const decodedSlug = decodeURIComponent(inputSlug).trim();

  try {
    // 1) Try translation slug lookup.
    let translationFoundBySlug: any = null;
    try {
      translationFoundBySlug = await (db as any).courseTranslation.findFirst({
        where: { locale, slug: decodedSlug, status: 'translated' },
        include: { course: true },
      });
    } catch {
      /* table missing */
    }

    // 2) Try original course slug lookup.
    let courseFoundByOriginalSlug: any = null;
    try {
      courseFoundByOriginalSlug = await db.course.findUnique({ where: { slug: decodedSlug } });
    } catch {
      /* table missing */
    }

    // 3) If course found, try translation by courseId.
    let translationByCourseId: any = null;
    if (courseFoundByOriginalSlug) {
      try {
        translationByCourseId = await (db as any).courseTranslation.findUnique({
          where: { courseId_locale: { courseId: courseFoundByOriginalSlug.id, locale } },
        });
      } catch {
        /* ignore */
      }
    }

    return NextResponse.json({
      success: true,
      inputSlug,
      decodedSlug,
      locale,
      translationFoundBySlug: translationFoundBySlug
        ? {
            id: translationFoundBySlug.id,
            courseId: translationFoundBySlug.courseId,
            slug: translationFoundBySlug.slug,
            title: translationFoundBySlug.title,
            status: translationFoundBySlug.status,
          }
        : null,
      courseFoundByOriginalSlug: courseFoundByOriginalSlug
        ? {
            id: courseFoundByOriginalSlug.id,
            slug: courseFoundByOriginalSlug.slug,
            title: courseFoundByOriginalSlug.title,
          }
        : null,
      courseId: courseFoundByOriginalSlug?.id || null,
      translatedSlug: translationByCourseId?.slug || null,
      translationStatus: translationByCourseId?.status || null,
      isPublishable: translationByCourseId
        ? (PUBLISHABLE_STATUSES as unknown as string[]).includes(translationByCourseId.status)
        : false,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
