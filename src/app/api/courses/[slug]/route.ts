import { NextResponse } from 'next/server';
import { getCourseBySlug, getRelatedCourses, updateCourse } from '@/lib/mongodb';

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

// POST /api/courses/[slug] - Coupon status check
// Since Udemy blocks server-side requests (403), we check based on:
// 1. Expiry date estimate
// 2. Whether the coupon code exists and looks valid
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json().catch(() => ({}));
    const { action } = body;

    if (action !== 'verify') {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }

    const course = await getCourseBySlug(slug);
    if (!course) {
      return NextResponse.json(
        { success: false, error: 'Course not found' },
        { status: 404 }
      );
    }

    const couponCode = course.couponCode || '';
    const couponUrl = course.couponUrl || course.udemyUrl;

    // No coupon = not free
    if (!couponCode || !couponUrl) {
      return NextResponse.json({
        success: true,
        isFree: false,
        verified: true,
        message: 'no-coupon',
        hasCoupon: false,
      });
    }

    // Check if the estimated expiry has passed
    const expiresAt = course.couponExpiresAt;
    let isExpired = false;
    if (expiresAt) {
      const now = new Date();
      isExpired = new Date(expiresAt) < now;
    }

    // Check how old the scrape is (courses older than 7 days are likely expired)
    const scrapedAt = course.scrapedAt ? new Date(course.scrapedAt) : null;
    const daysSinceScrape = scrapedAt ? (Date.now() - scrapedAt.getTime()) / (1000 * 60 * 60 * 24) : 0;
    const isStale = daysSinceScrape > 7;

    const isLikelyValid = !isExpired && !isStale;

    // Update the course in the database
    await updateCourse(course.id, {
      couponVerified: isLikelyValid,
    });

    return NextResponse.json({
      success: true,
      isFree: isLikelyValid,
      verified: true,
      message: isLikelyValid ? 'likely-valid' : (isExpired ? 'expired-date' : 'stale-course'),
      hasCoupon: true,
      couponCode,
      couponUrl,
      expiresAt: expiresAt?.toISOString() || null,
      daysSinceScrape: Math.round(daysSinceScrape),
    });
  } catch (e) {
    console.error('Coupon verify error:', e);
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
