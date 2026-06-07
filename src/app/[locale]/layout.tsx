import { notFound } from 'next/navigation'
import { isSupportedLocale, localeDir, SUPPORTED_LOCALES } from '@/lib/i18n'
import { LocaleHtml } from '@/components/locale-html'

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isSupportedLocale(locale)) notFound()

  return (
    <>
      <LocaleHtml locale={locale} dir={localeDir(locale)} />
      {children}
    </>
  )
}
