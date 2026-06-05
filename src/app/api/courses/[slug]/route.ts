import { NextResponse } from 'next/server';
import { getCourseBySlug, getRelatedCourses } from '@/lib/mongodb';

// GET /api/courses/[slug] - Get single course by slug
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const course = await getCourseBySlug(slug);

    if (!course) {
      return NextResponse.json(
        { success: false, error: 'Course not found' },
        { status: 404 }
      );
    }

    // Get related courses from the same category
    const related = await getRelatedCourses(course.category, slug, 4);

    return NextResponse.json({
      success: true,
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        instructor: course.instructor || '',
        category: course.category,
        imageUrl: course.imageUrl,
        image_url: course.imageUrl,
        udemyUrl: course.udemyUrl,
        udemy_url: course.udemyUrl,
        source: course.source,
        sourceDetail: course.sourceDetail || null,
        rating: course.rating || null,
        students_count: course.studentsCount || null,
        original_price: course.originalPrice || null,
        language: course.language || null,
        duration: course.duration || null,
        requirements: course.requirements || '',
        whoFor: course.whoFor || '',
        whatLearn: course.whatLearn || '',
        lastUpdated: course.lastUpdated || null,
        couponCode: course.couponCode || null,
        couponUrl: course.couponUrl || null,
        couponExpiresAt: course.couponExpiresAt?.toISOString() || null,
        isFreeForever: course.isFreeForever || false,
        isPublished: course.isPublished,
        telegramPosted: course.telegramPosted,
        scraped_at: course.scrapedAt,
        created_at: course.createdAt,
      },
      related: related.map(c => ({
        id: c.id,
        title: c.title,
        slug: c.slug,
        imageUrl: c.imageUrl,
        image_url: c.imageUrl,
        category: c.category,
        source: c.source,
        sourceDetail: c.sourceDetail || null,
        rating: c.rating || null,
        students_count: c.studentsCount || null,
        instructor: c.instructor,
        couponExpiresAt: c.couponExpiresAt?.toISOString() || null,
        isFreeForever: c.isFreeForever || false,
      })),
    });
  } catch (e) {
    console.error('Course detail error:', e);
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
