import type { Metadata } from 'next';
import Link from 'next/link';
import { getCourseBySlug, getRelatedCourses } from '@/lib/queries';
import { CATEGORIES } from '@/lib/translations';
import { SiteHeader, SiteFooter } from '@/components/site-chrome';
import { CourseImage } from '@/components/course-image';
import { BulletList } from '@/components/bullet-list';
import { TimedReveal } from '@/components/timed-reveal';
import { TelegramChannelButton } from '@/components/telegram-cta';
import { ShareButtons } from '@/components/share-buttons';
import { notFound } from 'next/navigation';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '';
const PLACEHOLDER_IMG = 'https://img-b.udemycdn.com/course/480x270/placeholder.jpg';

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
    title: course.title,
    description,
    alternates: { canonical: `/course/${course.slug}` },
    openGraph: {
      title: course.title,
      description,
      url: courseUrl,
      siteName: 'Learn Plus Courses',
      images: [{ url: imageUrl, width: 750, height: 422, alt: course.title }],
      type: 'article',
    },
    twitter: { card: 'summary_large_image', title: course.title, description, images: [imageUrl] },
  };
}

function getCat(name: string): { name: string; icon: string } {
  return CATEGORIES[name] || { name: 'Other', icon: '' };
}

function formatNumber(n: number | null | undefined): string {
  if (n == null || n === 0) return '-';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toLocaleString();
}

export default async function CoursePage({ params }: PageProps) {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);

  if (!course) notFound();
  if (!course.isPublished) notFound();

  const related = await getRelatedCourses(course.category, slug, 4);
  const catInfo = getCat(course.category);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title,
    description: (course.description || '').slice(0, 400) || `Free Udemy course: ${course.title}`,
    url: `${SITE_URL}/course/${course.slug}`,
    ...(course.imageUrl ? { image: course.imageUrl } : {}),
    ...(course.language ? { inLanguage: course.language } : {}),
    provider: { '@type': 'Organization', name: 'Udemy', sameAs: 'https://www.udemy.com' },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', category: 'Free', availability: 'https://schema.org/InStock' },
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader backHref="/" backLabel="Home" />

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="relative aspect-[16/7] bg-muted rounded-xl overflow-hidden">
          <CourseImage src={course.imageUrl || PLACEHOLDER_IMG} alt={course.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-md border bg-white/90 dark:bg-black/60 text-foreground dark:text-white backdrop-blur-sm font-medium">
              {catInfo.name}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-foreground text-background font-bold">
              {course.isFreeForever ? 'FREE FOREVER' : 'FREE COUPON'}
            </span>
          </div>
          <div className="absolute bottom-3 left-3 right-3">
            <h1 className="text-white font-bold text-lg sm:text-2xl leading-tight drop-shadow-md line-clamp-2">{course.title}</h1>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {course.instructor && (
            <div className="flex items-center gap-2 p-2.5 bg-card rounded-lg border text-xs">
              <div className="min-w-0">
                <p className="text-muted-foreground text-[10px]">Instructor</p>
                <p className="font-medium truncate">{course.instructor}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 p-2.5 bg-card rounded-lg border text-xs">
            <div className="min-w-0">
              <p className="text-muted-foreground text-[10px]">Rating</p>
              <p className="font-medium">{course.rating ? `${course.rating}/5` : '-'}</p>
            </div>
          </div>
          {course.studentsCount && course.studentsCount > 0 && (
            <div className="flex items-center gap-2 p-2.5 bg-card rounded-lg border text-xs">
              <div className="min-w-0">
                <p className="text-muted-foreground text-[10px]">Students</p>
                <p className="font-medium">{formatNumber(course.studentsCount)}</p>
              </div>
            </div>
          )}
          {course.language && (
            <div className="flex items-center gap-2 p-2.5 bg-card rounded-lg border text-xs">
              <div className="min-w-0">
                <p className="text-muted-foreground text-[10px]">Language</p>
                <p className="font-medium">{course.language}</p>
              </div>
            </div>
          )}
          {course.duration && (
            <div className="flex items-center gap-2 p-2.5 bg-card rounded-lg border text-xs">
              <div className="min-w-0">
                <p className="text-muted-foreground text-[10px]">Duration</p>
                <p className="font-medium">{course.duration}</p>
              </div>
            </div>
          )}
          {course.originalPrice && (
            <div className="flex items-center gap-2 p-2.5 bg-card rounded-lg border text-xs">
              <div className="min-w-0">
                <p className="text-muted-foreground text-[10px]">Was</p>
                <p className="font-medium line-through text-muted-foreground">${course.originalPrice}</p>
              </div>
            </div>
          )}
        </div>

        {course.isFreeForever && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border">
            <p className="text-xs text-muted-foreground font-medium">This course is free forever. You keep it for life after enrolling.</p>
          </div>
        )}

        {course.description && (
          <div className="p-4 rounded-lg border bg-card">
            <h3 className="text-xs font-semibold mb-2">Description</h3>
            <BulletList text={course.description} />
          </div>
        )}
        {course.whatLearn && (
          <div className="p-4 rounded-lg border bg-card">
            <h3 className="text-xs font-semibold mb-2">What You&apos;ll Learn</h3>
            <BulletList text={course.whatLearn} />
          </div>
        )}
        {course.requirements && (
          <div className="p-4 rounded-lg border bg-card">
            <h3 className="text-xs font-semibold mb-2">Requirements</h3>
            <BulletList text={course.requirements} />
          </div>
        )}
        {course.whoFor && (
          <div className="p-4 rounded-lg border bg-card">
            <h3 className="text-xs font-semibold mb-2">Who This Course Is For</h3>
            <BulletList text={course.whoFor} />
          </div>
        )}

        <div className="p-4 rounded-lg border bg-card space-y-2">
          <h3 className="text-xs font-semibold">Important Notes</h3>
          <p className="text-[11px] text-muted-foreground leading-relaxed">Once you start the course for free, it stays in your account forever. You keep lifetime access.</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">Free access is time-limited. If a course is no longer free when you reach it, please check back later. The catalogue updates regularly.</p>
        </div>

        <div className="space-y-3">
          <div className="p-4 rounded-lg border bg-card text-center space-y-1">
            <h2 className="font-bold text-sm">Get this course for free</h2>
            <p className="text-[11px] text-muted-foreground">We are preparing your free access. The button appears in a few seconds.</p>
          </div>
          <TimedReveal seconds={10} loadingText="Loading your course..." buttonText="Continue to the course" href={`/course/${course.slug}/enroll`} />
          <TelegramChannelButton label="Join our channel for more free courses" />
          <ShareButtons url={`${SITE_URL}/course/${course.slug}`} title={course.title} />
        </div>

        {related.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold mb-3">Related Courses</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {related.map((rc) => {
                const rcCat = getCat(rc.category);
                return (
                  <Link key={rc.id} href={`/course/${rc.slug}`} className="block overflow-hidden rounded-lg border bg-card hover:shadow-md hover:border-border transition-all group">
                    <div className="relative aspect-[16/9] bg-muted">
                      <CourseImage src={rc.imageUrl || PLACEHOLDER_IMG} alt={rc.title} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" loading="lazy" />
                    </div>
                    <div className="p-2">
                      <h4 className="text-[11px] font-medium line-clamp-2 group-hover:text-muted-foreground leading-snug">{rc.title}</h4>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[10px] px-1 py-0.5 rounded border bg-muted">{rcCat.name}</span>
                        {rc.rating && <span className="text-[10px] text-muted-foreground">{rc.rating}</span>}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <div className="text-center pt-4 pb-8">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">Browse all free courses</Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
