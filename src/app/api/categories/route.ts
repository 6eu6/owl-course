import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/categories - List all categories with course counts
export async function GET() {
  try {
    const categories = await db.course.groupBy({
      by: ['category'],
      where: { isPublished: true },
      _count: { category: true },
      _avg: { rating: true },
    });

    const sorted = categories
      .map(c => ({
        name: c.category,
        slug: c.category.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-'),
        course_count: c._count.category,
        avg_rating: c._avg.rating ? Math.round(c._avg.rating * 10) / 10 : null,
      }))
      .sort((a, b) => b.course_count - a.course_count);

    return NextResponse.json({
      success: true,
      categories: sorted,
      total: sorted.length,
    });
  } catch (e) {
    console.error('Categories API error:', e);
    return NextResponse.json(
      { success: false, categories: [], total: 0, error: String(e) },
      { status: 500 }
    );
  }
}
