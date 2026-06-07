import { db } from '@/lib/db'
import { slugifyArabic, slugifyLatin, truncateForMeta, type Locale } from './i18n'
import { getLocalizedCategory } from './locale-text'

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

async function translateWithModel(course: CourseLike): Promise<TranslationPayload> {
  const apiKey = process.env.TRANSLATION_API_KEY || process.env.OPENAI_API_KEY || ''
  if (!apiKey) throw new Error('Missing TRANSLATION_API_KEY or OPENAI_API_KEY')

  const model = process.env.TRANSLATION_MODEL || 'gpt-4o-mini'
  const input = originalPayload(course)

  const prompt = [
    'Translate this Udemy course metadata from English to Arabic for an Arabic course-discovery website.',
    'Requirements:',
    '- Return ONLY valid JSON.',
    '- Keep technical terms clear and natural for Arabic learners.',
    '- Do not translate brand names like Udemy, Python, React, AWS, Excel, GPT unless commonly written in Arabic text.',
    '- Preserve meaning; do not invent new facts.',
    '- Make metaTitle and metaDescription suitable for SEO in Arabic.',
    '- Keep arrays/paragraphs as readable Arabic text; no markdown.',
    '',
    JSON.stringify(input),
  ].join('\n')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a precise English-to-Arabic localization engine.' },
        { role: 'user', content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) throw new Error(`Translation API failed: ${response.status}`)
  const json = await response.json()
  const content = json?.choices?.[0]?.message?.content || '{}'
  const parsed = JSON.parse(content)

  return {
    title: clean(parsed.title) || input.title,
    description: clean(parsed.description) || input.description,
    requirements: clean(parsed.requirements) || input.requirements,
    whoFor: clean(parsed.whoFor) || input.whoFor,
    whatLearn: clean(parsed.whatLearn) || input.whatLearn,
    category: clean(parsed.category) || getLocalizedCategory('ar', input.category),
    metaTitle: clean(parsed.metaTitle) || clean(parsed.title) || input.title,
    metaDescription: truncateForMeta(clean(parsed.metaDescription) || clean(parsed.description) || input.description),
  }
}

export async function translateCourseToArabic(course: CourseLike) {
  await (db as any).courseTranslation.upsert({
    where: { courseId_locale: { courseId: course.id, locale: 'ar' } },
    update: { status: 'pending', error: null },
    create: {
      courseId: course.id,
      locale: 'ar',
      title: course.title,
      slug: await uniqueTranslationSlug('ar', slugifyArabic(course.title, course.slug), course.id),
      status: 'pending',
    },
  })

  try {
    const payload = await translateWithModel(course)
    const slug = await uniqueTranslationSlug('ar', slugifyArabic(payload.title, course.slug), course.id)

    return await (db as any).courseTranslation.update({
      where: { courseId_locale: { courseId: course.id, locale: 'ar' } },
      data: {
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
    })
  } catch (err) {
    await (db as any).courseTranslation.update({
      where: { courseId_locale: { courseId: course.id, locale: 'ar' } },
      data: { status: 'failed', error: String(err).slice(0, 500) },
    })
    throw err
  }
}

export async function getCoursesMissingTranslation(locale: Locale, limit: number) {
  return (db as any).course.findMany({
    where: {
      isPublished: true,
      translations: { none: { locale, status: 'translated' } },
    },
    orderBy: { scrapedAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 20),
  })
}

export async function processTranslationBatch(locale: Locale, limit: number) {
  const courses = await getCoursesMissingTranslation(locale, limit)
  const results: Array<{ courseId: string; title: string; status: string; error?: string }> = []

  for (const course of courses) {
    try {
      if (locale === 'en') await ensureEnglishTranslation(course)
      else await translateCourseToArabic(course)
      results.push({ courseId: course.id, title: course.title, status: 'translated' })
    } catch (err) {
      results.push({ courseId: course.id, title: course.title, status: 'failed', error: String(err).slice(0, 220) })
    }
  }

  return { processed: results.length, results }
}

// Resolve a course for a localized page. Tries the locale's translation slug
// first, then falls back to the original Course slug (English fallback during
// rollout). All translation reads are guarded so pages keep working even before
// the i18n tables are bootstrapped.
export async function getLocalizedCourseBySlug(locale: Locale, slug: string) {
  try {
    const tr = await (db as any).courseTranslation.findFirst({
      where: { locale, slug, status: 'translated' },
      include: { course: true },
    })
    if (tr?.course) return { course: tr.course, translation: tr }
  } catch {
    /* i18n table missing — fall back to the original course below */
  }

  const course = await db.course.findUnique({ where: { slug } })
  if (!course) return null

  let translation: any = null
  try {
    translation = await (db as any).courseTranslation.findUnique({
      where: { courseId_locale: { courseId: course.id, locale } },
    })
  } catch {
    /* ignore */
  }
  return { course, translation: translation?.status === 'translated' ? translation : null }
}

// Per-locale slugs for a course, used for canonical + hreflang alternates.
// Falls back to the original slug when a locale has no translation yet.
export async function getCourseLocaleSlugs(courseId: string, fallbackSlug: string) {
  const out: Record<Locale, string> = { en: fallbackSlug, ar: fallbackSlug }
  try {
    const rows = await (db as any).courseTranslation.findMany({
      where: { courseId, status: 'translated' },
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
        where: { locale, status: 'translated', courseId: { in: courses.map((c) => c.id) } },
      })
      map = new Map((rows as any[]).map((r) => [r.courseId, r]))
    } catch {
      /* table missing — fall back to originals */
    }
  }
  return courses.map((c) => localizedCourseData(c, map.get(c.id) || null, locale))
}

export function localizedCourseData(course: any, translation: any | null, locale: Locale) {
  if (!translation || translation.status !== 'translated') {
    return {
      ...course,
      locale,
      localizedSlug: course.slug,
      localizedTitle: course.title,
      localizedDescription: course.description || '',
      localizedRequirements: course.requirements || '',
      localizedWhoFor: course.whoFor || '',
      localizedWhatLearn: course.whatLearn || '',
      localizedCategory: locale === 'ar' ? getLocalizedCategory('ar', course.category) : course.category,
      metaTitle: course.title,
      metaDescription: truncateForMeta(course.description || `Free Udemy course: ${course.title}`),
    }
  }

  return {
    ...course,
    locale,
    localizedSlug: translation.slug,
    localizedTitle: translation.title,
    localizedDescription: translation.description || '',
    localizedRequirements: translation.requirements || '',
    localizedWhoFor: translation.whoFor || '',
    localizedWhatLearn: translation.whatLearn || '',
    localizedCategory: translation.category || getLocalizedCategory(locale, course.category),
    metaTitle: translation.metaTitle || translation.title,
    metaDescription: translation.metaDescription || truncateForMeta(translation.description || course.description || ''),
  }
}
