import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { COLLECTIONS } from '@/lib/types';
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
      settings = { site_name: 'OWL COURSE', site_description: 'Free Online Courses Platform', courses_per_page: 12, scraper_enabled: true, scraper_interval_hours: 6 };
    }

    let col;
    try {
      col = await getCollection(COLLECTIONS.COURSES);
    } catch {
      // MongoDB not connected - return empty
      return NextResponse.json({
        courses: [],
        pagination: { page, limit, total: 0, total_pages: 0 },
        filters: { categories: [], current_category: '', current_search: '', current_source: '' },
        stats: { total_courses: 0, udemy_courses: 0, studybullet_courses: 0 },
        settings,
      });
    }

    // Build query
    const query: Record<string, unknown> = { is_published: true };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { instructor: { $regex: search, $options: 'i' } },
      ];
    }
    if (category) query.category = category;
    if (source) query.source = source;

    const skip = (page - 1) * limit;
    const [courses, total] = await Promise.all([
      col.find(query).sort({ scraped_at: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments(query),
    ]);

    const categories = await col.distinct('category', { is_published: true });
    const totalCourses = await col.countDocuments({ is_published: true });
    const udemyCount = await col.countDocuments({ is_published: true, source: 'udemyfreebies' });
    const studybulletCount = await col.countDocuments({ is_published: true, source: 'studybullet' });

    return NextResponse.json({
      courses: courses.map((c: Record<string, unknown>) => ({
        id: String(c._id),
        title: c.title,
        slug: c.slug,
        description: String(c.description || '')?.slice(0, 200),
        instructor: c.instructor || '',
        category: c.category,
        image_url: c.image_url,
        source: c.source,
        rating: c.rating || null,
        students_count: c.students_count || null,
        original_price: c.original_price || null,
        language: c.language || null,
        scraped_at: c.scraped_at,
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
