import { SiteHeader, SiteFooter } from '@/components/site-chrome'
import { localeDir, type Locale } from '@/lib/i18n'
import { makeT } from '@/lib/locale-text'

export type Block = { h?: string; p?: string; list?: string[] }

// Shared layout for the localized static pages (about / privacy / terms) so they
// share the exact same chrome, are locale-aware (RTL + Arabic content), and use
// the unified header/footer.
export function StaticPage({
  locale,
  title,
  updated,
  blocks,
}: {
  locale: Locale
  title: string
  updated?: boolean
  blocks: Block[]
}) {
  const t = makeT(locale)
  const base = `/${locale}`
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col" dir={localeDir(locale)}>
      <SiteHeader homeHref={base} backHref={base} backLabel={t('home')} backShort={t('home')} locale={locale} />
      <main className="max-w-3xl mx-auto w-full px-4 py-8 space-y-5">
        <h1 className="text-xl font-bold">{title}</h1>
        {updated && (
          <p className="text-xs text-muted-foreground">
            {locale === 'ar' ? 'آخر تحديث' : 'Last updated'}: {new Date().getFullYear()}
          </p>
        )}
        {blocks.map((b, i) => (
          <div key={i} className="space-y-2">
            {b.h && <h2 className="text-base font-semibold">{b.h}</h2>}
            {b.p && <p className="text-sm text-muted-foreground leading-relaxed">{b.p}</p>}
            {b.list && (
              <ul className="text-sm text-muted-foreground leading-relaxed list-disc list-inside space-y-1">
                {b.list.map((li, j) => (
                  <li key={j}>{li}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </main>
      <SiteFooter locale={locale} />
    </div>
  )
}
