import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { COLLECTIONS } from '@/lib/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const col = await getCollection(COLLECTIONS.COURSES);

    const course = await col.findOne({ slug, is_published: true });
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Get related courses (same category, different course)
    const related = await col
      .find({ category: course.category, slug: { $ne: slug }, is_published: true })
      .limit(4)
      .toArray();

    return NextResponse.json({
      course: {
        id: String(course._id),
        title: course.title,
        slug: course.slug,
        description: course.description,
        instructor: course.instructor || '',
        category: course.category,
        image_url: course.image_url,
        udemy_url: course.udemy_url,
        source: course.source,
        rating: course.rating || null,
        students_count: course.students_count || null,
        original_price: course.original_price || null,
        language: course.language || null,
        duration: course.duration || null,
        scraped_at: course.scraped_at,
      },
      related: related.map(c => ({
        id: String(c._id),
        title: c.title,
        slug: c.slug,
        image_url: c.image_url,
        category: c.category,
        rating: c.rating || null,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
