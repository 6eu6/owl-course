import { db } from '@/lib/db'
import { slugifyArabic, slugifyLatin, truncateForMeta, type Locale } from './i18n'
import { getLocalizedCategory } from './locale-text'

// Translation statuses:
//   pending    – row created, not translated yet
//   translated – fully translated and publishable
//   failed     – last attempt errored and can be retried
//
// Only fully translated rows are publishable.
// No partial translations should be shown on the Arabic site or posted to Telegram.
export const PUBLISHABLE_STATUSES = ['translated'] as const

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

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

// Bound a field's length so a single pathologically long description cannot blow
// the model's token budget. The caps are generous — real course fields are
// almost always shorter, so this rarely truncates anything meaningful.
function cap(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value
}

// Some providers wrap JSON in ```json fences or add stray prose. Pull out the
// first balanced-looking JSON object so JSON.parse succeeds across providers.
function extractJson(content: string): string {
  const text = String(content || '').trim()
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fenced ? fenced[1].trim() : text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) return body.slice(start, end + 1)
  return body || '{}'
}

// ---------------------------------------------------------------------------
// Arabic quality gate — reject translations that are still English.
// ---------------------------------------------------------------------------

function hasArabic(value: string): boolean {
  return /[\u0600-\u06FF]/.test(String(value || ''))
}

function countArabicChars(value: string): number {
  return (String(value || '').match(/[\u0600-\u06FF]/g) || []).length
}

function countLatinLetters(value: string): number {
  return (String(value || '').match(/[A-Za-z]/g) || []).length
}

function isMostlyArabic(value: string): boolean {
  const text = clean(value)
  if (!text) return true // empty optional field is acceptable
  const arabic = countArabicChars(text)
  const latin = countLatinLetters(text)
  // Must contain a meaningful amount of Arabic.
  if (arabic < 8) return false
  // Allow technical terms and brand names, but reject mostly-English fields.
  return arabic >= latin * 0.35
}

/** Check that a translation payload is sufficiently Arabic. */
export function validateArabicPayload(payload: TranslationPayload): string[] {
  const errors: string[] = []
  if (!hasArabic(payload.title)) errors.push('title is not Arabic')
  if (!isMostlyArabic(payload.description)) errors.push('description is not Arabic enough')
  if (!isMostlyArabic(payload.requirements)) errors.push('requirements is not Arabic enough')
  if (!isMostlyArabic(payload.whoFor)) errors.push('whoFor is not Arabic enough')
  if (!isMostlyArabic(payload.whatLearn)) errors.push('whatLearn is not Arabic enough')
  if (!hasArabic(payload.category)) errors.push('category is not Arabic')
  if (!hasArabic(payload.metaTitle)) errors.push('metaTitle is not Arabic')
  if (!isMostlyArabic(payload.metaDescription)) errors.push('metaDescription is not Arabic enough')
  return errors
}

/** Ensure non-empty source fields are not returned empty in translation. */
function requireTranslatedField(
  fieldName: keyof TranslationPayload,
  original: string,
  translated: string,
  errors: string[],
) {
  if (clean(original) && !clean(translated)) {
    errors.push(`${fieldName} missing translation`)
  }
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

// One chat/completions call. Throws an Error tagged with `.status` so the
// retry layer can react to 429 (rate limit) and 400 (invalid JSON) distinctly.
async function chatCompletion(
  apiUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  useJsonFormat: boolean,
): Promise<any> {
  const body: Record<string, unknown> = {
    model,
    temperature: 0.2,
    messages: [
      { role: 'system', content: 'You are a precise English-to-Arabic localization engine. Output only JSON.' },
      { role: 'user', content: prompt },
    ],
  }
  if (useJsonFormat) body.response_format = { type: 'json_object' }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    const err = new Error(`Translation API failed: ${response.status}`) as Error & { status?: number }
    err.status = response.status
    throw err
  }
  const json = await response.json()
  return JSON.parse(extractJson(json?.choices?.[0]?.message?.content || '{}'))
}

async function translateWithModel(course: CourseLike): Promise<TranslationPayload> {
  const apiKey = (process.env.TRANSLATION_API_KEY || process.env.OPENAI_API_KEY || '').trim()
  if (!apiKey) throw new Error('Missing TRANSLATION_API_KEY or OPENAI_API_KEY')

  // Works with any OpenAI-compatible chat/completions endpoint. Defaults to
  // OpenAI but can point at a free provider (e.g. Groq, Google Gemini's
  // OpenAI-compatible endpoint, or OpenRouter) via TRANSLATION_API_URL.
  // Tolerate values pasted with surrounding < > / quotes / whitespace.
  const apiUrl =
    (process.env.TRANSLATION_API_URL || 'https://api.openai.com/v1/chat/completions')
      .trim()
      .replace(/^[<"']+|[>"']+$/g, '')
      .trim()
  const model = (process.env.TRANSLATION_MODEL || 'gpt-4o-mini').trim()

  const raw = originalPayload(course)
  // Full translation, but bound the long fields to keep token usage sane.
  const input: TranslationPayload = {
    ...raw,
    description: cap(raw.description, 4000),
    requirements: cap(raw.requirements, 2000),
    whoFor: cap(raw.whoFor, 2000),
    whatLearn: cap(raw.whatLearn, 2000),
  }

  const prompt = [
    'Translate this Udemy course metadata from English to Arabic for an Arabic course-discovery website.',
    '',
    'STRICT RULES:',
    '- Return ONLY a valid JSON object.',
    '- Use exactly these keys: title, description, requirements, whoFor, whatLearn, category, metaTitle, metaDescription.',
    '- Translate every non-empty value into Arabic.',
    '- Do NOT leave English paragraphs in description, requirements, whoFor, or whatLearn.',
    '- Keep brand names and technical acronyms in English only when natural, such as AWS, CISA, Python, React, Excel, SQL, API, Udemy.',
    '- Preserve meaning. Do not invent facts.',
    '- If a source field is empty, return an empty string for that field.',
    '- No markdown. No commentary. No extra keys.',
    '',
    'Input JSON:',
    JSON.stringify(input),
  ].join('\n')

  // Retry around transient failures so a rate limit (429) or the occasional
  // invalid-JSON (400) never drops a course. Backoff stays within the cron's
  // per-request time budget.
  const backoff = [4000, 9000, 18000]
  let parsed: any
  for (let attempt = 0; ; attempt++) {
    try {
      parsed = await chatCompletion(apiUrl, apiKey, model, prompt, true)
      break
    } catch (e) {
      const status = (e as { status?: number })?.status
      if (status === 400) {
        // Model returned content that failed JSON-mode validation — retry once
        // without response_format and parse leniently.
        parsed = await chatCompletion(apiUrl, apiKey, model, prompt, false)
        break
      }
      const transient = status === 429 || status === undefined || (status >= 500)
      if (transient && attempt < backoff.length) {
        await sleep(backoff[attempt])
        continue
      }
      throw e
    }
  }

  // Build payload without English fallback — the model's Arabic output must
  // stand on its own. Empty model output is acceptable for optional fields;
  // non-empty source fields that come back empty will fail the requireTranslatedField check.
  const payload: TranslationPayload = {
    title: clean(parsed.title),
    description: clean(parsed.description),
    requirements: clean(parsed.requirements),
    whoFor: clean(parsed.whoFor),
    whatLearn: clean(parsed.whatLearn),
    category: clean(parsed.category),
    metaTitle: clean(parsed.metaTitle),
    metaDescription: truncateForMeta(clean(parsed.metaDescription)),
  }

  // 1) Reject if non-empty source fields came back empty.
  const missing: string[] = []
  for (const field of ['title', 'description', 'requirements', 'whoFor', 'whatLearn', 'category', 'metaTitle', 'metaDescription'] as const) {
    requireTranslatedField(field, input[field], payload[field], missing)
  }
  if (missing.length > 0) {
    throw new Error(`Arabic translation missing fields: ${missing.join(', ')}`)
  }

  // 2) Reject if the output is not actually Arabic.
  const qualityErrors = validateArabicPayload(payload)
  if (qualityErrors.length > 0) {
    throw new Error(`Arabic translation quality check failed: ${qualityErrors.join(', ')}`)
  }

  return payload
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

// A course "needs translation" when it has no fully `translated` row for the
// locale. Newest courses come first, so freshly scraped courses are always
// translated before older backlog is enriched.
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
      where: { locale, slug, status: { in: PUBLISHABLE_STATUSES as unknown as string[] } },
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
  const usable = translation && (PUBLISHABLE_STATUSES as unknown as string[]).includes(translation.status)
  return { course, translation: usable ? translation : null }
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
