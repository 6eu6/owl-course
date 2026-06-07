import type { Metadata } from 'next';
import Link from 'next/link';
import { getCourseBySlug, getRelatedCourses } from '@/lib/mongodb';
import { CATEGORIES } from '@/lib/translations';
import { LogoMark } from '@/components/logo';
import { CourseImage } from '@/components/course-image';
import { notFound } from 'next/navigation';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '';
const PLACEHOLDER_IMG = 'https://img-b.udemycdn.com/course/480x270/placeholder.jpg';

// ============================================
// Metadata Generation (Server-side)
// ============================================

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);

  if (!course) {
    return { title: 'Course Not Found | Learn Plus Courses' };
  }

  const description = (course.description || '').slice(0, 200).trim() || `Free Udemy course: ${course.title}`;
  const imageUrl = course.imageUrl || PLACEHOLDER_IMG;
  const courseUrl = `${SITE_URL}/course/${course.slug}`;

  return {
    title: `${course.title} | Learn Plus Courses`,
    description,
    openGraph: {
      title: course.title,
      description,
      url: courseUrl,
      siteName: 'Learn Plus Courses',
      images: [
        {
          url: imageUrl,
          width: 750,
          height: 422,
          alt: course.title,
        },
      ],
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: course.title,
      description,
      images: [imageUrl],
    },
  };
}

// ============================================
// Helper: Get category info
// ============================================

function getCat(name: string): { name: string; icon: string } {
  return CATEGORIES[name] || { name: 'Other', icon: '📚' };
}

// ============================================
// Helper: Format number
// ============================================

function formatNumber(n: number | null | undefined): string {
  if (n == null || n === 0) return '-';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toLocaleString();
}

// ============================================
// Helper: Build Udemy URL with coupon
// ============================================

function buildUdemyUrl(course: {
  udemyUrl: string;
  couponUrl: string;
  couponCode: string;
}): string {
  const couponUrl = course.couponUrl;
  if (couponUrl) return couponUrl;

  const baseUrl = course.udemyUrl;
  const couponCode = course.couponCode;

  if (couponCode && baseUrl) {
    try {
      const urlObj = new URL(baseUrl);
      urlObj.searchParams.set('couponCode', couponCode);
      return urlObj.toString();
    } catch {
      // ignore
    }
  }

  return baseUrl;
}

// ============================================
// Course Page Component (Server Component)
// ============================================

export default async function CoursePage({ params }: PageProps) {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);

  if (!course) {
    notFound();
  }

  // Only show published courses
  if (!course.isPublished) {
    notFound();
  }

  const related = await getRelatedCourses(course.category, slug, 4);
  const catInfo = getCat(course.category);
  const udemyUrl = buildUdemyUrl(course);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header / Nav */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href={SITE_URL || '/'}
            className="flex items-center gap-2 text-sm font-semibold hover:text-muted-foreground dark:hover:text-muted-foreground transition-colors"
          >
            <LogoMark className="h-5 w-5" />
            <span>Learn Plus Courses</span>
          </Link>
          <Link
            href={SITE_URL || '/'}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Hero Image */}
        <div className="relative aspect-[16/7] bg-muted rounded-xl overflow-hidden">
          <CourseImage
            src={course.imageUrl || PLACEHOLDER_IMG}
            alt={course.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Badges */}
          <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-md border bg-white/90 dark:bg-black/60 text-foreground dark:text-white backdrop-blur-sm font-medium">
              {catInfo.icon} {catInfo.name}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-foreground text-background font-bold">
              {course.isFreeForever ? 'FREE FOREVER' : 'FREE COUPON'}
            </span>
          </div>

          {/* Title overlay */}
          <div className="absolute bottom-3 left-3 right-3">
            <h1 className="text-white font-bold text-lg sm:text-2xl leading-tight drop-shadow-md line-clamp-2">
              {course.title}
            </h1>
          </div>
        </div>

        {/* Info Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {course.instructor && (
            <div className="flex items-center gap-2 p-2.5 bg-card rounded-lg border text-xs">
              <span className="shrink-0 text-muted-foreground">👤</span>
              <div className="min-w-0">
                <p className="text-muted-foreground text-[10px]">Instructor</p>
                <p className="font-medium truncate">{course.instructor}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 p-2.5 bg-card rounded-lg border text-xs">
            <span className="shrink-0 text-muted-foreground">⭐</span>
            <div className="min-w-0">
              <p className="text-muted-foreground text-[10px]">Rating</p>
              <p className="font-medium">
                {course.rating ? `${course.rating}/5` : '-'}
              </p>
            </div>
          </div>
          {course.studentsCount && course.studentsCount > 0 && (
            <div className="flex items-center gap-2 p-2.5 bg-card rounded-lg border text-xs">
              <span className="shrink-0 text-muted-foreground">👥</span>
              <div className="min-w-0">
                <p className="text-muted-foreground text-[10px]">Students</p>
                <p className="font-medium">{formatNumber(course.studentsCount)}</p>
              </div>
            </div>
          )}
          {course.language && (
            <div className="flex items-center gap-2 p-2.5 bg-card rounded-lg border text-xs">
              <span className="shrink-0 text-muted-foreground">🌍</span>
              <div className="min-w-0">
                <p className="text-muted-foreground text-[10px]">Language</p>
                <p className="font-medium">{course.language}</p>
              </div>
            </div>
          )}
          {course.duration && (
            <div className="flex items-center gap-2 p-2.5 bg-card rounded-lg border text-xs">
              <span className="shrink-0 text-muted-foreground">⏱️</span>
              <div className="min-w-0">
                <p className="text-muted-foreground text-[10px]">Duration</p>
                <p className="font-medium">{course.duration}</p>
              </div>
            </div>
          )}
          {course.originalPrice && (
            <div className="flex items-center gap-2 p-2.5 bg-card rounded-lg border text-xs">
              <span className="shrink-0 text-muted-foreground">🏷️</span>
              <div className="min-w-0">
                <p className="text-muted-foreground text-[10px]">Was</p>
                <p className="font-medium line-through text-muted-foreground">
                  ${course.originalPrice}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Free forever banner */}
        {course.isFreeForever && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted dark:bg-muted border border-border dark:border-border">
            <span className="text-xl shrink-0">♾️</span>
            <p className="text-xs text-muted-foreground dark:text-muted-foreground font-medium">
              This course is free forever — you keep it for life after enrolling
            </p>
          </div>
        )}

        {/* CTA - Enroll Free */}
        <div className="p-4 rounded-lg bg-muted dark:bg-muted border border-border dark:border-border">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex-1 text-center sm:text-left">
              <h2 className="font-bold text-sm text-muted-foreground dark:text-muted-foreground">
                Get this course for free!
              </h2>
              <p className="text-[11px] text-muted-foreground dark:text-muted-foreground mt-0.5">
                100% free coupon — direct enrollment on Udemy, no payment required
              </p>
            </div>
            <a
              href={udemyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-foreground hover:bg-foreground text-background font-bold h-11 px-6 text-xs rounded-lg transition-colors shrink-0"
            >
              🚀 Enroll Free →
            </a>
          </div>
        </div>

        {/* Description */}
        {course.description && (
          <div className="p-4 rounded-lg border bg-card">
            <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
              <span className="text-muted-foreground">📖</span> Description
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
              {course.description}
            </p>
          </div>
        )}

        {/* What You'll Learn */}
        {course.whatLearn && (
          <div className="p-4 rounded-lg border bg-card">
            <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
              <span className="text-muted-foreground">🎯</span> What You&apos;ll Learn
            </h3>
            <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
              {course.whatLearn}
            </div>
          </div>
        )}

        {/* Requirements */}
        {course.requirements && (
          <div className="p-4 rounded-lg border bg-card">
            <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
              <span className="text-muted-foreground">⚠️</span> Requirements
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
              {course.requirements}
            </p>
          </div>
        )}

        {/* Who This Course Is For */}
        {course.whoFor && (
          <div className="p-4 rounded-lg border bg-card">
            <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
              <span className="text-muted-foreground">👥</span> Who This Course Is For
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
              {course.whoFor}
            </p>
          </div>
        )}

        {/* Important Notes */}
        <div className="p-4 rounded-lg border bg-card space-y-2">
          <h3 className="text-xs font-semibold flex items-center gap-1.5">
            <span className="text-muted-foreground">🛡️</span> Important Notes
          </h3>
          <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
            <span className="text-muted-foreground shrink-0">✓</span>
            <p className="leading-relaxed">
              Once you enroll for free using a coupon, the course stays in your account forever even after the coupon expires.
            </p>
          </div>
          <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
            <span className="text-muted-foreground shrink-0">⚠</span>
            <p className="leading-relaxed">
              Coupons are time-limited and may expire at any time. If you find the course is paid, try again after the next scraper run.
            </p>
          </div>
        </div>

        {/* Related Courses */}
        {related.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold mb-3">
              Related Courses
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {related.map((rc) => {
                const rcCat = getCat(rc.category);
                return (
                  <Link
                    key={rc.id}
                    href={`/course/${rc.slug}`}
                    className="block overflow-hidden rounded-lg border bg-card hover:shadow-md hover:border-border dark:hover:border-border transition-all group"
                  >
                    <div className="relative aspect-[16/9] bg-muted">
                      <CourseImage
                        src={rc.imageUrl || PLACEHOLDER_IMG}
                        alt={rc.title}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-2">
                      <h4 className="text-[11px] font-medium line-clamp-2 group-hover:text-muted-foreground dark:group-hover:text-muted-foreground leading-snug">
                        {rc.title}
                      </h4>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[10px] px-1 py-0.5 rounded border bg-muted">
                          {rcCat.icon} {rcCat.name}
                        </span>
                        {rc.rating && (
                          <span className="text-[10px] text-muted-foreground">
                            ⭐ {rc.rating}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Back to Home */}
        <div className="text-center pt-4 pb-8">
          <Link
            href={SITE_URL || '/'}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Browse All Free Courses
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 text-center text-xs text-muted-foreground">
          <p>Learn Plus Courses — Free Udemy Courses</p>
          <p className="mt-1">Fresh free coupons, updated automatically</p>
        </div>
      </footer>
    </div>
  );
}
