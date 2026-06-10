import { NextResponse } from 'next/server';
import { countCourses, countCoursesBySource, countNewToday, getLastScrapeTime } from '@/lib/queries';
import { db } from '@/lib/db';

// GET /api/stats - Dashboard statistics
export async function GET() {
  try {
    const [total, published, unpublished, bySource, newToday, lastScrapeTime] = await Promise.all([
      countCourses({}),
      countCourses({ isPublished: true }),
      countCourses({ isPublished: false }),
      countCoursesBySource(),
      countNewToday(),
      getLastScrapeTime(),
    ]);

    // Count unique categories
    const categoryResult = await db.course.groupBy({
      by: ['category'],
      where: { isPublished: true },
    });

    // Count telegram posted
    const telegramPosted = await countCourses({ telegramPosted: true });

    // Count by source with friendly names
    const sourceBreakdown = bySource.map(s => ({
      source: s._id,
      count: s.count,
      label: s._id === 'udemyfreebies' ? 'UdemyFreebies'
        : s._id === 'studybullet' ? 'StudyBullet'
        : s._id === 'manual' ? 'Manual' : s._id,
    }));

    return NextResponse.json({
      success: true,
      courses: {
        total,
        published,
        unpublished,
        newToday,
      },
      categories: {
        count: categoryResult.length,
      },
      sources: sourceBreakdown,
      telegram: {
        total_posted: telegramPosted,
        pending: published - telegramPosted,
      },
      lastScrape: lastScrapeTime ? lastScrapeTime.toISOString() : null,
    });
  } catch (e) {
    console.error('Stats API error:', e);
    return NextResponse.json(
      {
        success: false,
        courses: { total: 0, published: 0, unpublished: 0, newToday: 0 },
        categories: { count: 0 },
        sources: [],
        telegram: { total_posted: 0, pending: 0 },
        lastScrape: null,
        error: String(e),
      },
      { status: 500 }
    );
  }
}
