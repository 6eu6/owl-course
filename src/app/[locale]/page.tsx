import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { HomeClient } from '@/components/home-client'
import { isSupportedLocale } from '@/lib/i18n'
import { makeT } from '@/lib/locale-text'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.learn-plus.uk'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  if (!isSupportedLocale(locale)) return {}
  const t = makeT(locale)
  const title = `${t('siteName')} — ${t('siteTagline')}`
  return {
    title,
    description: t('footerDesc'),
    alternates: {
      canonical: `${SITE}/${locale}`,
      languages: {
        en: `${SITE}/en`,
        ar: `${SITE}/ar`,
        'x-default': `${SITE}/en`,
      },
    },
  }
}

export default async function LocaleHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isSupportedLocale(locale)) notFound()
  return <HomeClient locale={locale} basePath={`/${locale}`} />
}
