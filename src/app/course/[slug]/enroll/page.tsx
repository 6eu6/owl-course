import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCourseBySlug } from '@/lib/queries'
import { buildUdemyUrl } from '@/lib/course-url'
import { CourseImage } from '@/components/course-image'
import { TimedReveal } from '@/components/timed-reveal'
import { BulletList } from '@/components/bullet-list'
import { SiteHeader, SiteFooter } from '@/components/site-chrome'
import { ReportBrokenLinkButton } from '@/components/report-broken-link-button'

const PLACEHOLDER_IMG = 'https://img-b.udemycdn.com/course/480x270/placeholder.jpg'

interface PageProps {
  params: Promise<{ slug: string }>
}

// Thin gateway page. Keep it out of the index. The /course/[slug] info page
// is the canonical, indexable page.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const course = await getCourseBySlug(slug)
  return {
    title: course ? `Start: ${course.title}` : 'Start course',
    robots: { index: false, follow: true },
    alternates: { canonical: `/course/${slug}` },
  }
}

export default async function EnrollPage({ params }: PageProps) {
  const { slug } = await params
  const course = await getCourseBySlug(slug)
  if (!course || !course.isPublished) notFound()

  const udemyUrl = buildUdemyUrl(course)

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader backHref={`/course/${slug}`} backLabel="Course details" />

      <main className="max-w-3xl mx-auto w-full px-4 py-6 space-y-5">
        <div className="relative aspect-[16/7] bg-muted rounded-xl overflow-hidden">
          <CourseImage
            src={course.imageUrl || PLACEHOLDER_IMG}
            alt={course.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3">
            <h1 className="text-white font-bold text-lg sm:text-2xl leading-tight drop-shadow-md line-clamp-2">
              {course.title}
            </h1>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4 text-center space-y-1">
          <h2 className="font-bold text-sm">You are almost there</h2>
          <p className="text-[11px] text-muted-foreground">
            Read the details below while we prepare your course link. It opens on the provider site
            with the discount already applied.
          </p>
        </div>

        {course.description && (
          <section className="p-4 rounded-lg border bg-card">
            <h3 className="text-xs font-semibold mb-2">About this course</h3>
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
              {course.description}
            </p>
          </section>
        )}
        {course.whatLearn && (
          <section className="p-4 rounded-lg border bg-card">
            <h3 className="text-xs font-semibold mb-2">What you&apos;ll learn</h3>
            <BulletList text={course.whatLearn} />
          </section>
        )}
        {course.requirements && (
          <section className="p-4 rounded-lg border bg-card">
            <h3 className="text-xs font-semibold mb-2">Requirements</h3>
            <BulletList text={course.requirements} />
          </section>
        )}

        <div className="space-y-3">
          <TimedReveal
            seconds={25}
            loadingText="Preparing your course link..."
            buttonText="Start the course on Udemy"
            href={udemyUrl}
            external
          />
          <ReportBrokenLinkButton slug={course.slug} title={course.title} />
        </div>

        <div className="text-center pb-4">
          <Link href={`/course/${slug}`} className="text-xs text-muted-foreground hover:text-foreground">
            Back to course details
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
