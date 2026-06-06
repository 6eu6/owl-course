import { NextResponse } from 'next/server';
import { getAllCourses, getAllCategories, countCourses } from '@/lib/mongodb';
import { getSiteSettings } from '@/lib/settings';

// GET /api/courses - List courses with pagination, filtering, search
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const source = searchParams.get('source') || '';
    const sort = searchParams.get('sort') || 'newest';
    const freeForever = searchParams.get('freeForever') || '';

    let settings: { site_name: string; site_description: string; courses_per_page: number };
    try {
      settings = await getSiteSettings();
    } catch {
      settings = { site_name: 'Learn Plus Courses', site_description: '', courses_per_page: 12 };
    }

    const { courses, total } = await getAllCourses({ page, limit, search, category, source, sort });
    const categories = await getAllCategories();
    const totalCourses = await countCourses({ isPublished: true });

    return NextResponse.json({
      success: true,
      courses: courses.map(c => ({
        id: c.id,
        title: c.title,
        slug: c.slug,
        description: c.description?.slice(0, 200) || '',
        instructor: c.instructor || '',
        category: c.category,
        imageUrl: c.imageUrl,
        image_url: c.imageUrl,
        rating: c.rating || null,
        students_count: c.studentsCount || null,
        original_price: c.originalPrice || null,
        language: c.language || null,
        duration: c.duration || null,
        couponExpiresAt: c.couponExpiresAt?.toISOString() || null,
        isFreeForever: c.isFreeForever || false,
        couponVerified: c.couponVerified || false,
        scraped_at: c.scrapedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
      filters: {
        categories,
        current_category: category,
        current_search: search,
        current_source: source,
        current_sort: sort,
        current_freeForever: freeForever,
      },
      stats: {
        total_courses: totalCourses,
      },
      settings,
    });
  } catch (e) {
    console.error('Courses API error:', e);
    return NextResponse.json(
      {
        success: false,
        courses: [],
        pagination: { page: 1, limit: 12, total: 0, total_pages: 0 },
        filters: { categories: [], current_category: '', current_search: '', current_source: '', current_sort: 'newest', current_freeForever: '' },
        stats: { total_courses: 0 },
        settings: { site_name: 'Learn Plus Courses', site_description: '', courses_per_page: 12 },
        error: String(e),
      },
      { status: 500 }
    );
  }
}
