import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// =============================================================================
// i18n status / diagnosis endpoint — Learn Plus Courses
// -----------------------------------------------------------------------------
// Read-only snapshot of the translation pipeline. Does NOT mutate any row.
//
// GET /api/cron/i18n-status?secret=CRON_SECRET
// =============================================================================
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret') || '';
  const expected = process.env.CRON_SECRET || process.env.ADMIN_PASSWORD || '';

  if (expected && secret !== expected) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const publishedCourse = { isPublished: true };

    const [
      totalCourses,
      arTranslated,
      arFailed,
      arPending,
      arMissing,
      lastArFailures,
    ] = await Promise.all([
      db.course.count({ where: publishedCourse }),
      (db as any).courseTranslation.count({ where: { locale: 'ar', status: 'translated', course: publishedCourse } }),
      (db as any).courseTranslation.count({ where: { locale: 'ar', status: 'failed', course: publishedCourse } }),
      (db as any).courseTranslation.count({ where: { locale: 'ar', status: 'pending', course: publishedCourse } }),
      db.course.count({ where: { isPublished: true, translations: { none: { locale: 'ar' } } } }),
      (db as any).courseTranslation.findMany({
        where: { locale: 'ar', status: 'failed' },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: { courseId: true, title: true, error: true, updatedAt: true },
      }),
    ]);

    // English is ready the moment it is scraped — it posts from Course rows and
    // needs no CourseTranslation(en). So enReady is simply the published count.
    const enReady = totalCourses;

    // arReadyForPost: Arabic translated rows on published courses are exactly
    // the set the post cron can publish to /ar channels.
    const arReadyForPost = arTranslated;

    return NextResponse.json({
      success: true,
      totalCourses,
      enReady,
      arTranslated,
      arFailed,
      arPending,
      arMissing,
      arReadyForPost,
      lastArFailures: (lastArFailures as any[]).map((r) => ({
        courseId: r.courseId,
        title: r.title,
        error: r.error,
        updatedAt: r.updatedAt,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
