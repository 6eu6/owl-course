import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCourseBySlug } from '@/lib/queries'
import { buildUdemyUrl } from '@/lib/course-url'
import { LogoMark } from '@/components/logo'
import { CourseImage } from '@/components/course-image'
import { TimedReveal } from '@/components/timed-reveal'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || ''
const PLACEHOLDER_IMG = 'https://img-b.udemycdn.com/course/480x270/placeholder.jpg'

interface PageProps {
  params: Promise<{ slug: string }>
}

// Thin gateway page — keep it out of the index (the /course/[slug] info page
// is the canonical, indexable page).
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
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
            <LogoMark className="h-5 w-5" />
            <span>Learn Plus Courses</span>
          </Link>
          <Link
            href={`/course/${slug}`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Course details
          </Link>
        </div>
      </header>

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
            We are generating your free enrollment link. It opens directly on Udemy with the
            discount already applied — no code to enter.
          </p>
        </div>

        <TimedReveal
          seconds={25}
          loadingText="Preparing your free course link…"
          buttonText="🚀 Start the course on Udemy →"
          href={udemyUrl}
          external
        />

        {/* More info to read while the link is being prepared */}
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
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
              {course.whatLearn}
            </p>
          </section>
        )}
        {course.requirements && (
          <section className="p-4 rounded-lg border bg-card">
            <h3 className="text-xs font-semibold mb-2">Requirements</h3>
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
              {course.requirements}
            </p>
          </section>
        )}
      </main>

      <footer className="border-t mt-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 text-center text-xs text-muted-foreground space-x-3">
          <Link href="/about" className="hover:text-foreground">About</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
        </div>
      </footer>
    </div>
  )
}
