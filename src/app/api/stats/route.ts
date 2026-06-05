import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { COLLECTIONS } from '@/lib/types';

export async function GET() {
  try {
    const coursesCol = await getCollection(COLLECTIONS.COURSES);

    const [total, published, unpublished, bySource, byCategory] = await Promise.all([
      coursesCol.countDocuments({}),
      coursesCol.countDocuments({ is_published: true }),
      coursesCol.countDocuments({ is_published: false }),
      coursesCol.aggregate([{ $group: { _id: '$source', count: { $sum: 1 } } }]).toArray(),
      coursesCol.distinct('category'),
    ]);

    const msgCol = await getCollection(COLLECTIONS.TELEGRAM_MESSAGES);
    const telegramStats = {
      total_posted: await coursesCol.countDocuments({ telegram_posted: true }),
      total_messages: await msgCol.countDocuments({}),
    };

    return NextResponse.json({
      courses: { total, published, unpublished },
      by_source: bySource,
      categories: byCategory.sort(),
      telegram: telegramStats,
    });
  } catch (e) {
    // Return empty stats if MongoDB is not connected
    return NextResponse.json({
      courses: { total: 0, published: 0, unpublished: 0 },
      by_source: [],
      categories: [],
      telegram: { total_posted: 0, total_messages: 0 },
      error: String(e),
    });
  }
}
