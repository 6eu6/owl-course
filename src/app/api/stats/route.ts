import { NextResponse } from 'next/server';
import { countCourses, countCoursesBySource, getAllCategories, getRecentTelegramMessages } from '@/lib/mongodb';

export async function GET() {
  try {
    const [total, published, unpublished, bySource, categories] = await Promise.all([
      countCourses({}),
      countCourses({ isPublished: true }),
      countCourses({ isPublished: false }),
      countCoursesBySource(),
      getAllCategories(),
    ]);

    const telegramPosted = await countCourses({ telegramPosted: true });
    const messages = await getRecentTelegramMessages(10);

    return NextResponse.json({
      courses: { total, published, unpublished },
      by_source: bySource,
      categories: categories.sort(),
      telegram: {
        total_posted: telegramPosted,
        total_messages: messages.length,
      },
    });
  } catch (e) {
    return NextResponse.json({
      courses: { total: 0, published: 0, unpublished: 0 },
      by_source: [],
      categories: [],
      telegram: { total_posted: 0, total_messages: 0 },
      error: String(e),
    });
  }
}
