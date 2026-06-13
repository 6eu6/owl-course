import { db } from '@/lib/db'
import { slugifyArabic, slugifyLatin, truncateForMeta, type Locale } from './i18n'
import { getLocalizedCategory } from './locale-text'
import { generateCourseContent, generateMeta } from './content-bank'

// Translation statuses:
//   pending    – row created, not translated yet
//   translated – fully translated and publishable
//   failed     – last attempt errored and can be retried
//
// Only fully translated rows are publishable.
// No partial translations should be shown on the Arabic site or posted to Telegram.
export const PUBLISHABLE_STATUSES = ['translated'] as const

type CourseLike = {
  id: string
  title: string
  slug: string
  description?: string | null
  requirements?: string | null
  whoFor?: string | null
  whatLearn?: string | null
  category?: string | null
}

type TranslationPayload = {
  title: string
  description: string
  requirements: string
  whoFor: string
  whatLearn: string
  category: string
  metaTitle: string
  metaDescription: string
}

function clean(value: unknown): string {
  return String(value ?? '').replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

function originalPayload(course: CourseLike): TranslationPayload {
  return {
    title: clean(course.title),
    description: clean(course.description),
    requirements: clean(course.requirements),
    whoFor: clean(course.whoFor),
    whatLearn: clean(course.whatLearn),
    category: clean(course.category) || 'Other',
    metaTitle: clean(course.title),
    metaDescription: truncateForMeta(clean(course.description) || `Free Udemy course: ${course.title}`),
  }
}

async function uniqueTranslationSlug(locale: Locale, desired: string, courseId: string): Promise<string> {
  const base = (desired || 'course').slice(0, 120)
  let slug = base
  let i = 2

  while (true) {
    const existing = await (db as any).courseTranslation.findFirst({
      where: { locale, slug, courseId: { not: courseId } },
      select: { id: true },
    })
    if (!existing) return slug
    slug = `${base.slice(0, 112)}-${i++}`
  }
}

export async function ensureEnglishTranslation(course: CourseLike) {
  const payload = originalPayload(course)
  const slug = await uniqueTranslationSlug('en', slugifyLatin(course.slug || payload.title), course.id)

  return (db as any).courseTranslation.upsert({
    where: { courseId_locale: { courseId: course.id, locale: 'en' } },
    update: {
      title: payload.title,
      slug,
      description: payload.description,
      requirements: payload.requirements,
      whoFor: payload.whoFor,
      whatLearn: payload.whatLearn,
      category: payload.category,
      metaTitle: payload.metaTitle,
      metaDescription: payload.metaDescription,
      status: 'translated',
      error: null,
      translatedAt: new Date(),
    },
    create: {
      courseId: course.id,
      locale: 'en',
      title: payload.title,
      slug,
      description: payload.description,
      requirements: payload.requirements,
      whoFor: payload.whoFor,
      whatLearn: payload.whatLearn,
      category: payload.category,
      metaTitle: payload.metaTitle,
      metaDescription: payload.metaDescription,
      status: 'translated',
      translatedAt: new Date(),
    },
  })
}

// Build the Arabic course row WITHOUT any AI/translation provider. The written
// body is generated from the category-aware Arabic bank (stable, on-topic, never
// fails, instant), and the title is kept as the course's real name so it stays
// accurate. This replaced an LLM pipeline that was slow, hit rate limits
// (429/409), required sleeps to dodge timeouts, and left many courses untranslated.
export async function translateCourseToArabic(course: CourseLike) {
  const category = course.category || 'Other'
  const gen = generateCourseContent(
    { id: course.id, title: course.title, category },
    'ar',
  )
  const slug = await uniqueTranslationSlug('ar', slugifyArabic(course.title, course.slug || course.id), course.id)
  const arCategory = getLocalizedCategory('ar', category)
  const meta = generateMeta({ id: course.id, title: course.title, categoryLabel: arCategory }, 'ar')

  const data = {
    title: course.title,
    slug,
    description: gen.description,
    requirements: gen.requirements,
    whoFor: gen.whoFor,
    whatLearn: gen.whatLearn,
    category: arCategory,
    metaTitle: meta.metaTitle,
    metaDescription: meta.metaDescription,
    status: 'translated',
    error: null,
    translatedAt: new Date(),
  }

  return await (db as any).courseTranslation.upsert({
    where: { courseId_locale: { courseId: course.id, locale: 'ar' } },
    update: data,
    create: { courseId: course.id, locale: 'ar', ...data },
  })
}

// A course "needs translation" when it has no fully `translated` row for the
// locale. Newest courses come first, so freshly scraped courses are always
// translated before older backlog is enriched.
//
// For Arabic the selection is tiered (missing → stale pending → old failed) and
// each tier is queried directly from the DB, so older missing rows are never
// starved by a window full of newer translated/failed rows. Failed rows only
// re-enter after FAILED_BACKOFF and only once no untranslated course remains,
// so one repeatedly-failing course can never block the queue.
const FAILED_BACKOFF_MS = 30 * 60 * 1000
const PENDING_BACKOFF_MS = 10 * 60 * 1000

export async function getCoursesMissingTranslation(locale: Locale, limit: number) {
  // Generation is instant and cannot fail, so a single tick can safely drain a
  // much larger batch than the old AI path (the 45s deadline still guards the
  // function timeout). This drains the Arabic backlog far faster.
  const take = Math.min(Math.max(limit, 1), 50)

  // English keeps the simple, fast selection — there is no model call to fail.
  if (locale !== 'ar') {
    return (db as any).course.findMany({
      where: {
        isPublished: true,
        translations: { none: { locale, status: 'translated' } },
      },
      orderBy: { scrapedAt: 'desc' },
      take,
    })
  }

  // Arabic: prioritized tiers, each queried directly so older missing rows are
  // never starved by a window full of newer translated/failed rows (which caused
  // processed:0 while arMissing>0). Failed rows are LAST, so they cannot consume
  // the queue while fresh untranslated courses still exist.
  //   1) courses with no Arabic row at all  (newest first)
  //   2) stale pending rows  (updatedAt older than PENDING_BACKOFF_MS)
  //   3) failed rows past the failure backoff (updatedAt older than FAILED_BACKOFF_MS)
  const now = Date.now()
  const pendingCutoff = new Date(now - PENDING_BACKOFF_MS)
  const failedCutoff = new Date(now - FAILED_BACKOFF_MS)

  const selected: any[] = []
  const seen = new Set<string>()
  const addRows = (rows: any[]) => {
    for (const c of rows) {
      if (seen.has(c.id)) continue
      seen.add(c.id)
      selected.push(c)
      if (selected.length >= take) break
    }
  }

  // Tier 1 — no Arabic translation yet.
  addRows(await (db as any).course.findMany({
    where: { isPublished: true, translations: { none: { locale: 'ar' } } },
    orderBy: { scrapedAt: 'desc' },
    take,
  }))

  // Tier 2 — stale pending rows.
  if (selected.length < take) {
    addRows(await (db as any).course.findMany({
      where: {
        isPublished: true,
        translations: { some: { locale: 'ar', status: 'pending', updatedAt: { lt: pendingCutoff } } },
      },
      orderBy: { scrapedAt: 'desc' },
      take: take - selected.length,
    }))
  }

  // Tier 3 — failed rows past the 30-minute backoff.
  if (selected.length < take) {
    addRows(await (db as any).course.findMany({
      where: {
        isPublished: true,
        translations: { some: { locale: 'ar', status: 'failed', updatedAt: { lt: failedCutoff } } },
      },
      orderBy: { scrapedAt: 'desc' },
      take: take - selected.length,
    }))
  }

  return selected
}

export async function processTranslationBatch(locale: Locale, limit: number, deadlineMs = 45_000) {
  const courses = await getCoursesMissingTranslation(locale, limit)
  const results: Array<{ courseId: string; title: string; status: string; error?: string }> = []
  const startedAt = Date.now()

  for (const course of courses) {
    // Stop starting new courses once we are close to the function time budget;
    // the rest are picked up on the next cron tick.
    if (Date.now() - startedAt > deadlineMs) break
    try {
      if (locale === 'en') await ensureEnglishTranslation(course)
      else await translateCourseToArabic(course)
      results.push({ courseId: course.id, title: course.title, status: 'translated' })
    } catch (err) {
      // Generation never calls a network provider, so the only errors here are
      // unexpected DB issues — record and continue (never blocks the batch).
      results.push({ courseId: course.id, title: course.title, status: 'failed', error: String(err).slice(0, 220) })
    }
  }

  return { processed: results.length, results }
}

// Resolve a course for a localized page. The slug param from Next.js may be
// percent-encoded (e.g. Arabic slugs like %D8%AF%D9%88%D8%B1%D8%A9), so we
// always decode it before the DB lookup.
//
// For locale='ar': NEVER returns { course, translation: null } — that would
// render Arabic headings with English body text. If there is no Arabic
// translation with status='translated', returns null so the page calls notFound.
//
// For locale='en': falls back to the original course with English fields.
export async function getLocalizedCourseBySlug(locale: Locale, slug: string) {
  const decodedSlug = decodeURIComponent(slug || '').trim()

  // 1) Try to match by translation slug first (most common path).
  try {
    const tr = await (db as any).courseTranslation.findFirst({
      where: { locale, slug: decodedSlug, status: 'translated' },
      include: { course: true },
    })
    if (tr?.course) return { course: tr.course, translation: tr }
  } catch {
    /* i18n table missing — fall through to original slug lookup */
  }

  // 2) Try to match by the original Course slug (covers /en/course/<original-slug>).
  const course = await db.course.findUnique({ where: { slug: decodedSlug } })
  if (!course) return null

  // 3) For English: return the course with an English translation if available.
  if (locale === 'en') {
    let translation: any = null
    try {
      translation = await (db as any).courseTranslation.findUnique({
        where: { courseId_locale: { courseId: course.id, locale: 'en' } },
      })
    } catch {
      /* ignore */
    }
    const usable = translation && (PUBLISHABLE_STATUSES as unknown as string[]).includes(translation.status)
    return { course, translation: usable ? translation : null }
  }

  // 4) For Arabic: only return if a translated Arabic row exists.
  //    NEVER return { course, translation: null } — the page must notFound instead.
  try {
    const tr = await (db as any).courseTranslation.findUnique({
      where: { courseId_locale: { courseId: course.id, locale: 'ar' } },
    })
    if (tr && (PUBLISHABLE_STATUSES as unknown as string[]).includes(tr.status)) {
      return { course, translation: tr }
    }
  } catch {
    /* ignore */
  }

  return null
}

// For an Arabic course page whose slug did not resolve to a translated Arabic
// row: decide where to send the user so a valid English course link under /ar
// never 404s. Returns a redirect path, or null when no such course exists (the
// caller then renders notFound()).
//
//   - course has a translated Arabic row  -> /ar/course/<arabicSlug>
//   - course exists but no Arabic yet     -> /en/course/<originalSlug>
//   - no such course                      -> null (404)
export async function resolveArabicFallbackRedirect(slug: string): Promise<string | null> {
  const decodedSlug = decodeURIComponent(slug || '').trim()
  if (!decodedSlug) return null

  const course = await db.course.findUnique({ where: { slug: decodedSlug } })
  if (!course || !course.isPublished) return null

  try {
    const tr = await (db as any).courseTranslation.findUnique({
      where: { courseId_locale: { courseId: course.id, locale: 'ar' } },
      select: { slug: true, status: true },
    })
    if (tr && (PUBLISHABLE_STATUSES as unknown as string[]).includes(tr.status)) {
      // Encode: Arabic slugs are non-ASCII and must be URL-safe in a Location header.
      return `/ar/course/${encodeURIComponent(tr.slug)}`
    }
  } catch {
    /* i18n table missing — fall through to the English page */
  }

  return `/en/course/${encodeURIComponent(course.slug)}`
}

// Per-locale slugs for a course, used for canonical + hreflang alternates.
// Falls back to the original slug when a locale has no translation yet.
export async function getCourseLocaleSlugs(courseId: string, fallbackSlug: string) {
  const out: Record<Locale, string> = { en: fallbackSlug, ar: fallbackSlug }
  try {
    const rows = await (db as any).courseTranslation.findMany({
      where: { courseId, status: { in: PUBLISHABLE_STATUSES as unknown as string[] } },
      select: { locale: true, slug: true },
    })
    for (const r of rows as Array<{ locale: Locale; slug: string }>) {
      if (r.locale === 'en' || r.locale === 'ar') out[r.locale] = r.slug
    }
  } catch {
    /* table missing — keep fallback for both locales */
  }
  return out
}

// Batch-localize a list of courses (used for related courses / grids).
export async function localizeCourseList(locale: Locale, courses: any[]) {
  let map = new Map<string, any>()
  if (locale !== 'en' && courses.length > 0) {
    try {
      const rows = await (db as any).courseTranslation.findMany({
        where: { locale, status: { in: PUBLISHABLE_STATUSES as unknown as string[] }, courseId: { in: courses.map((c) => c.id) } },
      })
      map = new Map((rows as any[]).map((r) => [r.courseId, r]))
    } catch {
      /* table missing — fall back to originals */
    }
  }
  return courses.map((c) => localizedCourseData(c, map.get(c.id) || null, locale))
}

export function localizedCourseData(course: any, translation: any | null, locale: Locale) {
  if (!translation || !(PUBLISHABLE_STATUSES as unknown as string[]).includes(translation.status)) {
    // For Arabic: return empty localized fields, NOT English fallback.
    // getLocalizedCourseBySlug should already return null for Arabic without translation,
    // but this is a safety net so Arabic headings never show English body text.
    if (locale === 'ar') {
      return {
        ...course,
        locale,
        localizedSlug: course.slug,
        localizedTitle: '',
        localizedDescription: '',
        localizedRequirements: '',
        localizedWhoFor: '',
        localizedWhatLearn: '',
        localizedCategory: getLocalizedCategory('ar', course.category),
        metaTitle: '',
        metaDescription: '',
      }
    }
    // For English: safe to fall back to original English fields. When the
    // scraper could not capture the written sections, fill them with stable,
    // category-appropriate generated copy so the enrol page is never blank.
    const gen = generateCourseContent({ id: course.id, title: course.title, category: course.category })
    const meta = generateMeta({ id: course.id, title: course.title, categoryLabel: course.category }, 'en')
    return {
      ...course,
      locale,
      localizedSlug: course.slug,
      localizedTitle: course.title,
      localizedDescription: course.description || gen.description,
      localizedRequirements: course.requirements || gen.requirements,
      localizedWhoFor: course.whoFor || gen.whoFor,
      localizedWhatLearn: course.whatLearn || gen.whatLearn,
      localizedCategory: course.category,
      metaTitle: meta.metaTitle,
      metaDescription: meta.metaDescription,
    }
  }

  // When a translated section is empty, fill it with stable, category-matched
  // copy generated in the target language — so the localized (e.g. Arabic) pages
  // are enriched just like English, never blank.
  const genLoc = generateCourseContent({ id: course.id, title: translation.title || course.title, category: course.category }, locale)
  const localizedCat = translation.category || getLocalizedCategory(locale, course.category)
  const meta = generateMeta({ id: course.id, title: translation.title || course.title, categoryLabel: localizedCat }, locale)
  return {
    ...course,
    locale,
    localizedSlug: translation.slug,
    localizedTitle: translation.title,
    localizedDescription: translation.description || genLoc.description,
    localizedRequirements: translation.requirements || genLoc.requirements,
    localizedWhoFor: translation.whoFor || genLoc.whoFor,
    localizedWhatLearn: translation.whatLearn || genLoc.whatLearn,
    localizedCategory: localizedCat,
    metaTitle: translation.metaTitle || meta.metaTitle,
    metaDescription: translation.metaDescription || meta.metaDescription,
  }
}
