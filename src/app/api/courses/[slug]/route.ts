import { NextResponse } from 'next/server';
import { getCourseBySlug, getRelatedCourses } from '@/lib/mongodb';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const course = await getCourseBySlug(slug);
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const related = await getRelatedCourses(course.category, slug, 4);

    return NextResponse.json({
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        instructor: course.instructor || '',
        category: course.category,
        image_url: course.imageUrl,
        udemy_url: course.udemyUrl,
        source: course.source,
        rating: course.rating || null,
        students_count: course.studentsCount || null,
        original_price: course.originalPrice || null,
        language: course.language || null,
        duration: course.duration || null,
        scraped_at: course.scrapedAt,
      },
      related: related.map(c => ({
        id: c.id,
        title: c.title,
        slug: c.slug,
        image_url: c.imageUrl,
        category: c.category,
        rating: c.rating || null,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
