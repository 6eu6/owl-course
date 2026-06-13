import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getLocalizedCourseBySlug, localizedCourseData, resolveArabicFallbackRedirect } from '@/lib/course-translations'
import { buildUdemyUrl } from '@/lib/course-url'
import { makeT } from '@/lib/locale-text'
import { isSupportedLocale, localeDir, type Locale } from '@/lib/i18n'
import { TimedReveal } from '@/components/timed-reveal'
import { TelegramChannelButton } from '@/components/telegram-cta'
import { BulletList } from '@/components/bullet-list'
import { SiteHeader, SiteFooter } from '@/components/site-chrome'
import { ReportBrokenLinkButton } from '@/components/report-broken-link-button'

interface PageProps {
  params: Promise<{ locale: string; slug: string }>
}

// Thin gateway page, kept out of the index. The localized /[locale]/course/[slug]
// info page is the canonical, indexable page.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isSupportedLocale(locale)) return {}
  const found = await getLocalizedCourseBySlug(locale, slug)
  const data = found ? localizedCourseData(found.course, found.translation, locale) : null
  return {
    title: data ? data.localizedTitle : 'Start course',
    robots: { index: false, follow: true },
    alternates: { canonical: `/${locale}/course/${slug}` },
  }
}

export default async function LocalizedEnrollPage({ params }: PageProps) {
  const { locale: rawLocale, slug } = await params
  if (!isSupportedLocale(rawLocale)) notFound()
  const locale = rawLocale as Locale
  const t = makeT(locale)
  const dir = localeDir(locale)
  const base = `/${locale}`

  const found = await getLocalizedCourseBySlug(locale, slug)
  if (!found || !found.course.isPublished) {
    // Under /ar, an English course slug should redirect (to the Arabic enroll
    // page if translated, otherwise to the English enroll page) instead of 404.
    if (locale === 'ar') {
      const target = await resolveArabicFallbackRedirect(slug)
      if (target) redirect(`${target}/enroll`)
    }
    notFound()
  }

  // Redirect if the user arrived via the wrong slug (e.g. English slug on /ar/ path).
  const decodedSlug = decodeURIComponent(slug || '').trim()
  if (found.translation && found.translation.slug && found.translation.slug !== decodedSlug) {
    // Encode: an Arabic slug placed raw in the Location header would 500 (headers are Latin-1).
    redirect(`/${locale}/course/${encodeURIComponent(found.translation.slug)}/enroll`)
  }

  const course = found.course
  const data = localizedCourseData(course, found.translation, locale)
  const udemyUrl = buildUdemyUrl(course)
  // Route the outbound click through /api/go, which decides per-visitor whether
  // to go direct or via the (ad-bearing) shortener, per the admin settings.
  const startUrl = `/api/go?u=${encodeURIComponent(udemyUrl)}`

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col" lang={locale} dir={dir}>
      <SiteHeader homeHref={base} backHref={`${base}/course/${data.localizedSlug}`} backLabel={t('courseDetails')} backShort={t('courseDetails')} locale={locale} />

      <main className="max-w-3xl mx-auto w-full px-4 py-6 space-y-5">
        <div className="relative aspect-[1600/746] rounded-xl border bg-card p-1 shadow-sm overflow-hidden">
          <img
            src="/enroll-guide-hero.svg?v=20260607-balanced"
            alt={data.localizedTitle}
            className="h-full w-full rounded-lg object-contain"
          />
        </div>

        <div className="rounded-lg border bg-card p-4 text-center space-y-1">
          <h2 className="font-bold text-sm">{t('almostThere')}</h2>
          <p className="text-[11px] text-muted-foreground">{t('almostThereDesc')}</p>
        </div>

        {data.localizedDescription && (
          <section className="p-4 rounded-lg border bg-card">
            <h3 className="text-xs font-semibold mb-2">{t('aboutCourse')}</h3>
            <BulletList text={data.localizedDescription} />
          </section>
        )}
        {data.localizedWhatLearn && (
          <section className="p-4 rounded-lg border bg-card">
            <h3 className="text-xs font-semibold mb-2">{t('whatLearn')}</h3>
            <BulletList text={data.localizedWhatLearn} />
          </section>
        )}
        {data.localizedRequirements && (
          <section className="p-4 rounded-lg border bg-card">
            <h3 className="text-xs font-semibold mb-2">{t('requirements')}</h3>
            <BulletList text={data.localizedRequirements} />
          </section>
        )}
        {data.localizedWhoFor && (
          <section className="p-4 rounded-lg border bg-card">
            <h3 className="text-xs font-semibold mb-2">{t('whoFor')}</h3>
            <BulletList text={data.localizedWhoFor} />
          </section>
        )}

        <div className="space-y-3">
          <TimedReveal
            seconds={25}
            loadingText={t('preparingLink')}
            buttonText={t('startOnUdemy')}
            href={startUrl}
            external
          />
          <TelegramChannelButton label={t('followChannel')} />
          <ReportBrokenLinkButton slug={course.slug} title={data.localizedTitle} />
        </div>

        <div className="text-center pb-4">
          <Link
            href={`${base}/course/${data.localizedSlug}`}
            className="inline-flex items-center justify-center rounded-lg border border-black bg-black px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-800 dark:border-white dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {t('backToCourse')}
          </Link>
        </div>
      </main>

      <SiteFooter locale={locale} />
    </div>
  )
}
