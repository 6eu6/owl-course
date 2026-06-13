import { db } from '@/lib/db'
import type { Locale } from './i18n'
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


// Build one Arabic CourseTranslation row WITHOUT any AI/translation provider.
// The written body is generated from the category-aware Arabic bank (stable,
// on-topic, instant, never fails) and the title is kept as the course's real
// name (most accurate). Pure/in-memory — no DB query. The slug is the course's
// own unique slug, so a whole batch can be inserted with createMany and never
// collide on the @@unique([locale, slug]) constraint.
function arabicRowData(course: CourseLike) {
  const category = course.category || 'Other'
  const gen = generateCourseContent({ id: course.id, title: course.title, category }, 'ar')
  const arCategory = getLocalizedCategory('ar', category)
  const meta = generateMeta({ id: course.id, title: course.title, categoryLabel: arCategory }, 'ar')
  return {
    courseId: course.id,
    locale: 'ar',
    title: course.title,
    slug: course.slug || course.id,
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
}

// Insert Arabic rows for brand-new courses in a SINGLE operation. Rows that
// already exist (courseId+locale or locale+slug) are skipped. Used at scrape
// time so a whole page's new courses cost one DB write instead of two per course.
export async function createArabicTranslations(courses: CourseLike[]): Promise<number> {
  if (courses.length === 0) return 0
  const res = await (db as any).courseTranslation.createMany({
    data: courses.map(arabicRowData),
    skipDuplicates: true,
  })
  return res.count ?? 0
}

// Regenerate Arabic rows for the given courses: drop any existing Arabic rows
// for them, then insert fresh — two operations total regardless of batch size.
// Used by the translate (backfill) and retranslate (refresh) crons.
export async function regenerateArabicTranslations(courses: CourseLike[]): Promise<number> {
  if (courses.length === 0) return 0
  const ids = courses.map((c) => c.id)
  await (db as any).courseTranslation.deleteMany({ where: { locale: 'ar', courseId: { in: ids } } })
  const res = await (db as any).courseTranslation.createMany({
    data: courses.map(arabicRowData),
    skipDuplicates: true,
  })
  return res.count ?? 0
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

async function getCoursesMissingArabic(limit: number) {
  // Generation is instant and cannot fail, so a single tick can safely drain a
  // large batch (the scrape generates Arabic inline anyway, so this is mostly a
  // backfill/safety net). Drains the Arabic backlog fast.
  const take = Math.min(Math.max(limit, 1), 50)

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

// English needs no translation rows (the /en site reads Course rows directly),
// so this only ever generates Arabic — as a single batch (two DB writes total)
// to keep database operation usage minimal.
export async function processTranslationBatch(locale: Locale, limit: number) {
  if (locale !== 'ar') return { processed: 0, results: [] as Array<{ courseId: string; title: string }> }
  const courses = await getCoursesMissingArabic(limit)
  if (courses.length === 0) return { processed: 0, results: [] as Array<{ courseId: string; title: string }> }
  const processed = await regenerateArabicTranslations(courses)
  return { processed, results: courses.map((c: CourseLike) => ({ courseId: c.id, title: c.title })) }
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
