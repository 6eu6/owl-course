import { NextResponse } from 'next/server';
import { getAllCourses, getAllCategories, countCourses, countCoursesBySource } from '@/lib/mongodb';
import { getSiteSettings } from '@/lib/settings';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const source = searchParams.get('source') || '';

    let settings;
    try {
      settings = await getSiteSettings();
    } catch {
      settings = { site_name: 'OWL COURSE', site_description: '', courses_per_page: 12, scraper_enabled: true, scraper_interval_hours: 6 };
    }

    const { courses, total } = await getAllCourses({ page, limit, search, category, source, published: true });
    const categories = await getAllCategories();
    const totalCourses = await countCourses({ isPublished: true });
    const udemyCount = await countCourses({ isPublished: true, source: 'udemyfreebies' });
    const studybulletCount = await countCourses({ isPublished: true, source: 'studybullet' });

    return NextResponse.json({
      courses: courses.map(c => ({
        id: c.id,
        title: c.title,
        slug: c.slug,
        description: c.description?.slice(0, 200) || '',
        instructor: c.instructor || '',
        category: c.category,
        image_url: c.imageUrl,
        source: c.source,
        rating: c.rating || null,
        students_count: c.studentsCount || null,
        original_price: c.originalPrice || null,
        language: c.language || null,
        scraped_at: c.scrapedAt,
      })),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
      filters: { categories: categories.sort(), current_category: category, current_search: search, current_source: source },
      stats: { total_courses: totalCourses, udemy_courses: udemyCount, studybullet_courses: studybulletCount },
      settings,
    });
  } catch (e) {
    return NextResponse.json({
      courses: [],
      pagination: { page: 1, limit: 12, total: 0, total_pages: 0 },
      filters: { categories: [], current_category: '', current_search: '', current_source: '' },
      stats: { total_courses: 0, udemy_courses: 0, studybullet_courses: 0 },
      settings: { site_name: 'OWL COURSE', site_description: '', courses_per_page: 12 },
      error: String(e),
    });
  }
}
