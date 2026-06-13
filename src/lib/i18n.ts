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

// ---------------------------------------------------------------------------
// Deterministic duration localization (NO AI).
//
// Course `duration` is plain English metadata ("10 total hours", "45 mins",
// "2h 30m") that is not part of CourseTranslation. We convert the common shapes
// into natural Arabic with correct singular/dual/plural forms. Anything we can't
// parse — or text that is already Arabic — is returned unchanged.
// ---------------------------------------------------------------------------

// Whole-number hours → natural Arabic (no "ونصف").
function arHours(n: number): string {
  if (n === 1) return 'ساعة واحدة'
  if (n === 2) return 'ساعتان'
  if (n >= 3 && n <= 10) return `${n} ساعات`
  return `${n} ساعة` // 11+ uses the singular tamyiz form
}

function arHalfHours(whole: number): string {
  if (whole <= 0) return 'نصف ساعة'
  if (whole === 1) return 'ساعة ونصف'
  if (whole === 2) return 'ساعتان ونصف'
  if (whole <= 10) return `${whole} ساعات ونصف`
  return `${whole} ساعة ونصف`
}

function arMinutes(n: number): string {
  if (n === 1) return 'دقيقة واحدة'
  if (n === 2) return 'دقيقتان'
  if (n >= 3 && n <= 10) return `${n} دقائق`
  return `${n} دقيقة` // 11+ (e.g. 30, 45) uses the singular tamyiz form
}

function formatArabicHours(h: number): string {
  const whole = Math.floor(h)
  if (Math.abs(h - whole) < 1e-9) return arHours(whole)
  if (Math.abs(h - whole - 0.5) < 1e-9) return arHalfHours(whole)
  return `${h} ساعات`
}

function formatArabicMinutes(m: number): string {
  const whole = Math.floor(m)
  if (Math.abs(m - whole) < 1e-9) return arMinutes(whole)
  return `${Math.round(m)} دقيقة`
}

export function localizeDuration(duration: string | null | undefined, locale: Locale): string {
  const raw = String(duration ?? '').replace(/\s+/g, ' ').trim()
  if (!raw) return ''
  // English keeps the original (cleaned) value.
  if (locale !== 'ar') return raw
  // Already Arabic — leave it untouched.
  if (/[؀-ۿ]/.test(raw)) return raw

  const lower = raw.toLowerCase()
  const hoursMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:total\s+)?(?:hours?|hrs?|h)\b/)
  const minutesMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:total\s+)?(?:minutes?|mins?|m)\b/)
  const hours = hoursMatch ? parseFloat(hoursMatch[1]) : 0
  const minutes = minutesMatch ? parseFloat(minutesMatch[1]) : 0

  // Could not parse a duration — return the original cleaned string.
  if (!hours && !minutes) return raw

  const parts: string[] = []
  if (hours) parts.push(formatArabicHours(hours))
  if (minutes) parts.push(formatArabicMinutes(minutes))
  return parts.join(' و')
}

const LANGUAGE_AR: Record<string, string> = {
  english: 'الإنجليزية', arabic: 'العربية', spanish: 'الإسبانية', french: 'الفرنسية',
  german: 'الألمانية', italian: 'الإيطالية', portuguese: 'البرتغالية', dutch: 'الهولندية',
  hindi: 'الهندية', urdu: 'الأردية', chinese: 'الصينية', japanese: 'اليابانية',
  korean: 'الكورية', russian: 'الروسية', turkish: 'التركية', indonesian: 'الإندونيسية',
}

/** Show the course language in Arabic on /ar; English (cleaned) elsewhere. */
export function localizeLanguage(language: string | null | undefined, locale: Locale): string {
  const raw = String(language ?? '').trim()
  if (!raw) return ''
  if (locale !== 'ar') return raw
  if (/[؀-ۿ]/.test(raw)) return raw
  return LANGUAGE_AR[raw.toLowerCase()] || raw
}
