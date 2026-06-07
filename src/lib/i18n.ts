export type Locale = 'en' | 'ar'

export const SUPPORTED_LOCALES: Locale[] = ['en', 'ar']
export const DEFAULT_LOCALE: Locale = 'en'

export function normalizeLocale(value: string | null | undefined): Locale {
  return value === 'ar' ? 'ar' : 'en'
}

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return value === 'en' || value === 'ar'
}

export function localeDir(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr'
}

export function localizedCoursePath(locale: Locale, slug: string): string {
  return `/${locale}/course/${slug}`
}

export function localizedHomePath(locale: Locale): string {
  return `/${locale}`
}

export function stripHtml(value: string): string {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function truncateForMeta(value: string, max = 155): string {
  const clean = stripHtml(value)
  if (clean.length <= max) return clean
  return clean.slice(0, max - 1).replace(/\s+\S*$/, '').trim() + '…'
}

export function slugifyLatin(text: string): string {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120) || 'course'
}

// Browser-safe Arabic slug. Arabic URLs are valid and useful for SEO, but we
// still remove punctuation and collapse whitespace so the slug is stable.
export function slugifyArabic(text: string, fallback: string): string {
  const clean = String(text || '')
    .trim()
    .replace(/[ـ]/g, '')
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)
  return clean || fallback
}
