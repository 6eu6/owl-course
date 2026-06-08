import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getRelatedCourses } from '@/lib/queries'
import {
  getLocalizedCourseBySlug,
  getCourseLocaleSlugs,
  localizedCourseData,
  localizeCourseList,
  resolveArabicFallbackRedirect,
} from '@/lib/course-translations'
import { makeT, getLocalizedCategory } from '@/lib/locale-text'
import { isSupportedLocale, localeDir, type Locale } from '@/lib/i18n'
import { SiteHeader, SiteFooter } from '@/components/site-chrome'
import { CourseImage } from '@/components/course-image'
import { BulletList } from '@/components/bullet-list'
import { TimedReveal } from '@/components/timed-reveal'
import { TelegramChannelButton } from '@/components/telegram-cta'
import { ShareButtons } from '@/components/share-buttons'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.learn-plus.uk'
const PLACEHOLDER_IMG = 'https://img-b.udemycdn.com/course/480x270/placeholder.jpg'

interface PageProps {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isSupportedLocale(locale)) return {}

  const found = await getLocalizedCourseBySlug(locale, slug)
  if (!found) return { title: 'Course Not Found | Learn Plus Courses' }

  const data = localizedCourseData(found.course, found.translation, locale)
  const slugs = await getCourseLocaleSlugs(found.course.id, found.course.slug)
  const imageUrl = found.course.imageUrl || PLACEHOLDER_IMG

  return {
    title: data.metaTitle,
    description: data.metaDescription,
    alternates: {
      canonical: `${SITE}/${locale}/course/${data.localizedSlug}`,
      languages: {
        en: `${SITE}/en/course/${slugs.en}`,
        ar: `${SITE}/ar/course/${slugs.ar}`,
        'x-default': `${SITE}/en/course/${slugs.en}`,
      },
    },
    openGraph: {
      title: data.metaTitle,
      description: data.metaDescription,
      url: `${SITE}/${locale}/course/${data.localizedSlug}`,
      siteName: 'Learn Plus Courses',
      images: [{ url: imageUrl, width: 750, height: 422, alt: data.localizedTitle }],
      type: 'article',
      locale: locale === 'ar' ? 'ar_AR' : 'en_US',
    },
    twitter: { card: 'summary_large_image', title: data.metaTitle, description: data.metaDescription, images: [imageUrl] },
  }
}

function formatNumber(n: number | null | undefined): string {
  if (n == null || n === 0) return '-'
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n.toLocaleString()
}

export default async function LocalizedCoursePage({ params }: PageProps) {
  const { locale: rawLocale, slug } = await params
  if (!isSupportedLocale(rawLocale)) notFound()
  const locale = rawLocale as Locale
  const t = makeT(locale)
  const dir = localeDir(locale)
  const base = `/${locale}`

  const found = await getLocalizedCourseBySlug(locale, slug)
  if (!found || !found.course.isPublished) {
    // Under /ar, a valid English course slug (e.g. an old/external link) should
    // not 404: send it to the Arabic page if translated, otherwise to /en.
    if (locale === 'ar') {
      const target = await resolveArabicFallbackRedirect(slug)
      if (target) redirect(target)
    }
    notFound()
  }

  // Redirect if the user arrived via the wrong slug (e.g. English slug on /ar/ path).
  const decodedSlug = decodeURIComponent(slug || '').trim()
  if (found.translation && found.translation.slug && found.translation.slug !== decodedSlug) {
    // Encode: an Arabic slug placed raw in the Location header would 500 (headers are Latin-1).
    redirect(`/${locale}/course/${encodeURIComponent(found.translation.slug)}`)
  }

  const course = found.course
  const data = localizedCourseData(course, found.translation, locale)

  const relatedRaw = await getRelatedCourses(course.category, course.slug, 4)
  const related = await localizeCourseList(locale, relatedRaw)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: data.localizedTitle,
    description: (data.localizedDescription || '').slice(0, 400) || data.metaDescription,
    url: `${SITE}/${locale}/course/${data.localizedSlug}`,
    inLanguage: locale,
    ...(course.imageUrl ? { image: course.imageUrl } : {}),
    provider: { '@type': 'Organization', name: 'Udemy', sameAs: 'https://www.udemy.com' },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', category: 'Free', availability: 'https://schema.org/InStock' },
  }

  return (
    <div className="min-h-screen bg-background text-foreground" lang={locale} dir={dir}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader homeHref={base} backHref={base} backLabel={t('home')} backShort={t('home')} />

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="relative aspect-[16/7] bg-muted rounded-xl overflow-hidden">
          <CourseImage src={course.imageUrl || PLACEHOLDER_IMG} alt={data.localizedTitle} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-md border bg-white/90 dark:bg-black/60 text-foreground dark:text-white backdrop-blur-sm font-medium">
              {getLocalizedCategory(locale, course.category)}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-foreground text-background font-bold">
              {course.isFreeForever ? t('freeForever') : t('freeCoupon')}
            </span>
          </div>
          <div className="absolute bottom-3 left-3 right-3">
            <h1 className="text-white font-bold text-lg sm:text-2xl leading-tight drop-shadow-md line-clamp-2">{data.localizedTitle}</h1>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {course.instructor && (
            <div className="flex items-center gap-2 p-2.5 bg-card rounded-lg border text-xs">
              <div className="min-w-0">
                <p className="text-muted-foreground text-[10px]">{t('instructor')}</p>
                <p className="font-medium truncate">{course.instructor}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 p-2.5 bg-card rounded-lg border text-xs">
            <div className="min-w-0">
              <p className="text-muted-foreground text-[10px]">{t('rating')}</p>
              <p className="font-medium">{course.rating ? `${course.rating}/5` : '-'}</p>
            </div>
          </div>
          {course.studentsCount && course.studentsCount > 0 && (
            <div className="flex items-center gap-2 p-2.5 bg-card rounded-lg border text-xs">
              <div className="min-w-0">
                <p className="text-muted-foreground text-[10px]">{t('students')}</p>
                <p className="font-medium">{formatNumber(course.studentsCount)}</p>
              </div>
            </div>
          )}
          {course.language && (
            <div className="flex items-center gap-2 p-2.5 bg-card rounded-lg border text-xs">
              <div className="min-w-0">
                <p className="text-muted-foreground text-[10px]">{t('language')}</p>
                <p className="font-medium">{course.language}</p>
              </div>
            </div>
          )}
          {course.duration && (
            <div className="flex items-center gap-2 p-2.5 bg-card rounded-lg border text-xs">
              <div className="min-w-0">
                <p className="text-muted-foreground text-[10px]">{t('duration')}</p>
                <p className="font-medium">{course.duration}</p>
              </div>
            </div>
          )}
          {course.originalPrice && (
            <div className="flex items-center gap-2 p-2.5 bg-card rounded-lg border text-xs">
              <div className="min-w-0">
                <p className="text-muted-foreground text-[10px]">{t('was')}</p>
                <p className="font-medium line-through text-muted-foreground">${course.originalPrice}</p>
              </div>
            </div>
          )}
        </div>

        {data.localizedDescription && (
          <div className="p-4 rounded-lg border bg-card">
            <h3 className="text-xs font-semibold mb-2">{t('description')}</h3>
            <BulletList text={data.localizedDescription} />
          </div>
        )}
        {data.localizedWhatLearn && (
          <div className="p-4 rounded-lg border bg-card">
            <h3 className="text-xs font-semibold mb-2">{t('whatLearn')}</h3>
            <BulletList text={data.localizedWhatLearn} />
          </div>
        )}
        {data.localizedRequirements && (
          <div className="p-4 rounded-lg border bg-card">
            <h3 className="text-xs font-semibold mb-2">{t('requirements')}</h3>
            <BulletList text={data.localizedRequirements} />
          </div>
        )}
        {data.localizedWhoFor && (
          <div className="p-4 rounded-lg border bg-card">
            <h3 className="text-xs font-semibold mb-2">{t('whoFor')}</h3>
            <BulletList text={data.localizedWhoFor} />
          </div>
        )}

        <div className="p-4 rounded-lg border bg-card space-y-2">
          <h3 className="text-xs font-semibold">{t('importantNotes')}</h3>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{t('note1')}</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{t('note2')}</p>
        </div>

        <div className="space-y-3">
          <div className="p-4 rounded-lg border bg-card text-center space-y-1">
            <h2 className="font-bold text-sm">{t('getCourseFree')}</h2>
            <p className="text-[11px] text-muted-foreground">{t('getCourseFreeDesc')}</p>
          </div>
          <TimedReveal
            seconds={10}
            loadingText={t('preparingLink')}
            buttonText={t('continueCourse')}
            href={`${base}/course/${data.localizedSlug}/enroll`}
          />
          <TelegramChannelButton label={t('joinChannel')} />
          <ShareButtons url={`${SITE}/${locale}/course/${data.localizedSlug}`} title={data.localizedTitle} />
        </div>

        {related.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold mb-3">{t('relatedCourses')}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {related.map((rc) => (
                <Link key={rc.id} href={`${base}/course/${rc.localizedSlug}`} className="block overflow-hidden rounded-lg border bg-card hover:shadow-md hover:border-border transition-all group">
                  <div className="relative aspect-[16/9] bg-muted">
                    <CourseImage src={rc.imageUrl || PLACEHOLDER_IMG} alt={rc.localizedTitle} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" loading="lazy" />
                  </div>
                  <div className="p-2">
                    <h4 className="text-[11px] font-medium line-clamp-2 group-hover:text-muted-foreground leading-snug">{rc.localizedTitle}</h4>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[10px] px-1 py-0.5 rounded border bg-muted">{getLocalizedCategory(locale, rc.category)}</span>
                      {rc.rating && <span className="text-[10px] text-muted-foreground">{rc.rating}</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="text-center pt-4 pb-8">
          <Link href={base} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">{t('browseAll')}</Link>
        </div>
      </main>

      <SiteFooter locale={locale} />
    </div>
  )
}
