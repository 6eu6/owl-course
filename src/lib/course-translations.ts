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

// A provider 429 is a temporary rate limit, not a real translation failure —
// it must never count toward arFailed or trip the failed backoff.
function isRateLimitError(err: unknown): boolean {
  return (err as { status?: number })?.status === 429 || String(err).includes('429')
}

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

// ---------------------------------------------------------------------------
// Arabic style normalization + validation.
//
// The model sometimes returns Arabic that is grammatically fine but reads like
// a machine translation ("دبلومة محترفة", "اختبارات ممارسة", "ماستر كلاس").
// normalizeArabicPayload rewrites those well-known awkward phrases into the
// natural form; validateArabicStyle flags anything still wrong so the repair
// pass (or a later retry) can fix it. Neither touches English brand names or
// technical acronyms — every rule below only matches Arabic letter sequences.
// ---------------------------------------------------------------------------

// Order matters: more specific phrases first so they win over the generic rule.
const AR_NORMALIZE: Array<[RegExp, string]> = [
  [/دبلومة\s+محترفة/g, 'دبلوم مهني'],
  [/دبلومة\s+مهنية/g, 'دبلوم مهني'],
  [/دبلومة/g, 'دبلوم'],
  [/اختبارات\s+ممارسة/g, 'اختبارات تدريبية'],
  [/امتحانات\s+ممارسة/g, 'اختبارات تدريبية'],
  [/اختبارات\s+الممارسة/g, 'اختبارات تدريبية'],
  [/ماستر\s+كلاس/g, 'دورة متقدمة'],
  [/الماستر\s+كلاس/g, 'الدورة المتقدمة'],
  [/صنع\s+بسيط/g, 'تبسيط'],
  [/إدارة\s+المكتب\b/g, 'إدارة المكاتب'],
]

// Insert a separating space where the model glued an Arabic letter directly to
// a Latin technical term ("استخدمChatGPT" -> "استخدم ChatGPT", "Pythonللمبتدئين"
// -> "Python للمبتدئين"). Only the Arabic⇄Latin LETTER boundary is touched:
//   - pure English tokens (ChatGPT, API, CySA+) are left unchanged,
//   - tatweel (الـAPI) is excluded, so it is preserved,
//   - CJK/Cyrillic/etc. are NOT modified here — they still fail validation.
export function normalizeArabicLatinSpacing(text: string): string {
  return String(text || '')
    .replace(/([ء-ؿف-ي])([A-Za-z])/g, '$1 $2')
    .replace(/([A-Za-z])([ء-ؿف-ي])/g, '$1 $2')
    .replace(/[ \t]{2,}/g, ' ')
}

function normalizeArabicText(value: string): string {
  let out = String(value || '')
  for (const [re, rep] of AR_NORMALIZE) out = out.replace(re, rep)
  // Auto-fix Arabic/Latin glued tokens BEFORE validation so well-meaning
  // translations are not failed just for a missing space around a brand name.
  out = normalizeArabicLatinSpacing(out)
  return out.replace(/[ \t]+/g, ' ').trim()
}

/** Rewrite known awkward Arabic phrasings into natural form across all fields. */
export function normalizeArabicPayload(payload: TranslationPayload): TranslationPayload {
  return {
    title: normalizeArabicText(payload.title),
    description: normalizeArabicText(payload.description),
    requirements: normalizeArabicText(payload.requirements),
    whoFor: normalizeArabicText(payload.whoFor),
    whatLearn: normalizeArabicText(payload.whatLearn),
    category: normalizeArabicText(payload.category),
    metaTitle: normalizeArabicText(payload.metaTitle),
    metaDescription: normalizeArabicText(payload.metaDescription),
  }
}

// Phrases that read as machine translation. If any survive normalization the
// output is rejected as low quality.
const AR_BANNED: Array<{ re: RegExp; msg: string }> = [
  { re: /دبلومة/, msg: 'awkward phrase "دبلومة" (use دبلوم)' },
  { re: /اختبارات\s+ممارسة|امتحانات\s+ممارسة|اختبارات\s+الممارسة/, msg: 'awkward phrase "اختبارات ممارسة" (use اختبارات تدريبية)' },
  { re: /ماستر\s+كلاس/, msg: 'awkward phrase "ماستر كلاس" (use دورة متقدمة)' },
  { re: /صنع\s+بسيط/, msg: 'awkward phrase "صنع بسيط" (use تبسيط)' },
]

/**
 * Style gate for Arabic copy. Rejects literal/awkward phrasing, raw English
 * titles, and non-Arabic scripts — but tolerates English brand names and
 * technical acronyms (AWS, Cisco, Python, …) embedded in Arabic sentences.
 */
export function validateArabicStyle(payload: TranslationPayload): string[] {
  const errors: string[] = []
  const allText = [
    payload.title,
    payload.description,
    payload.requirements,
    payload.whoFor,
    payload.whatLearn,
    payload.category,
    payload.metaTitle,
    payload.metaDescription,
  ].join('\n')

  for (const b of AR_BANNED) {
    if (b.re.test(allText)) errors.push(b.msg)
  }

  // The title must be a real Arabic title, not the raw English string.
  if (!hasArabic(payload.title)) errors.push('title is raw English, not Arabic')
  else if (countArabicChars(payload.title) < 3) errors.push('title has too little Arabic')

  // A genuine Arabic description is Arabic-dominant; an English paragraph that
  // slipped through has more Latin letters than Arabic ones. Acronyms cannot
  // trip this because real Arabic copy is overwhelmingly Arabic.
  if (clean(payload.description) && countLatinLetters(payload.description) > countArabicChars(payload.description)) {
    errors.push('description reads as English, not Arabic')
  }

  return errors
}

// ---------------------------------------------------------------------------
// Arabic editorial quality gate v2 — script + malformed + robotic checks.
//
// Arabic localized fields may contain: Arabic script, Latin letters (technical
// terms / brand names), digits, whitespace and common punctuation. ANY other
// script — Chinese/CJK, Japanese, Korean, Cyrillic — plus the Unicode
// replacement char or private-use characters is treated as broken output. This
// is what produced the stray glyph after "إعدادات", and "has Arabic somewhere"
// was not enough to catch it.
// ---------------------------------------------------------------------------

// Scripts/characters that must never appear in Arabic copy.
const DISALLOWED_SCRIPT =
  /[　-〿぀-ヿㇰ-ㇿ㐀-䶿一-鿿豈-﫿가-힯ᄀ-ᇿ㄰-㆏Ѐ-ԯ�-]/

/** True if the text contains CJK / Japanese / Korean / Cyrillic / garbled chars. */
export function containsUnexpectedScript(text: string): boolean {
  return DISALLOWED_SCRIPT.test(String(text || ''))
}

// Obvious malformed Arabic: stacked diacritics, tatweel runs, or an Arabic
// letter glued directly to a Latin letter inside one token (e.g. "الذكاءGPT").
// Brand tokens like ChatGPT / Vue.js / Node.js are pure-Latin and space-
// separated, and "الـAPI" uses tatweel (excluded), so they are not flagged.
function hasMalformedArabic(text: string): boolean {
  const t = String(text || '')
  if (/[ً-ٰٟ]{2,}/.test(t)) return true                     // 2+ stacked tashkeel marks
  if (/ـ{2,}/.test(t)) return true                                     // tatweel run ـــ
  if (/[\u0621-\u063F\u0641-\u064A][A-Za-z]|[A-Za-z][\u0621-\u063F\u0641-\u064A]/.test(t)) return true // Arabic letter glued to Latin
  return false
}

// Patterns that read like machine translation.
const ROBOTIC_PHRASES: RegExp[] = [
  /إعدادات\s+تقلب/,
  /اختبارات\s+ممارسة/,
  /امتحانات\s+ممارسة/,
  /ماستر\s+كلاس/,
  /صنع\s+بسيط/,
  /دبلومة/,
]

function hasRoboticArabicStyle(text: string): boolean {
  const t = String(text || '')
  if (ROBOTIC_PHRASES.some((re) => re.test(t))) return true
  // "من خلال" leaned on too many times signals literal translation.
  if ((t.match(/من\s+خلال/g) || []).length > 3) return true
  return false
}

/**
 * Editorial quality gate: rejects unexpected scripts, malformed Arabic tokens,
 * and robotic/literal phrasing across every localized field. Tolerates English
 * technical terms and brand names embedded in Arabic sentences.
 */
export function validateArabicEditorialQuality(payload: TranslationPayload): string[] {
  const errors: string[] = []
  const fields: Array<[string, string]> = [
    ['title', payload.title],
    ['description', payload.description],
    ['requirements', payload.requirements],
    ['whoFor', payload.whoFor],
    ['whatLearn', payload.whatLearn],
    ['category', payload.category],
    ['metaTitle', payload.metaTitle],
    ['metaDescription', payload.metaDescription],
  ]

  for (const [name, value] of fields) {
    if (!clean(value)) continue
    if (containsUnexpectedScript(value)) {
      errors.push(`${name} contains unexpected script (CJK/Cyrillic/Japanese/Korean/garbled characters)`)
    }
    if (hasMalformedArabic(value)) {
      errors.push(`${name} contains malformed Arabic (stacked marks, tatweel run, or Arabic glued to Latin)`)
    }
  }

  const allText = fields.map(([, v]) => v).join('\n')
  if (hasRoboticArabicStyle(allText)) errors.push('contains robotic/machine-translated phrasing')
  if (clean(payload.description).length > 800) errors.push('description is too long (should be 2–3 concise Arabic sentences)')

  return errors
}

/** Full Arabic gate: required fields + Arabic language + natural style + editorial quality. */
function collectArabicErrors(input: TranslationPayload, payload: TranslationPayload): string[] {
  const errors: string[] = []
  for (const field of ['title', 'description', 'requirements', 'whoFor', 'whatLearn', 'category', 'metaTitle', 'metaDescription'] as const) {
    requireTranslatedField(field, input[field], payload[field], errors)
  }
  errors.push(...validateArabicPayload(payload))
  errors.push(...validateArabicStyle(payload))
  errors.push(...validateArabicEditorialQuality(payload))
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
const AR_SYSTEM_PROMPT =
  'You are an expert Arabic localization editor for an online course-discovery website. ' +
  'You rewrite English course metadata into fluent, natural Modern Standard Arabic that reads ' +
  'like copy written by a native Arabic editor — never a literal, word-for-word translation. ' +
  'You preserve meaning and never invent facts. You output only a JSON object.'

async function chatCompletion(
  apiUrl: string,
  apiKey: string,
  model: string,
  prompt: string,
  useJsonFormat: boolean,
): Promise<any> {
  const body: Record<string, unknown> = {
    model,
    temperature: 0.35,
    messages: [
      { role: 'system', content: AR_SYSTEM_PROMPT },
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

function translationConfig() {
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
  return { apiKey, apiUrl, model }
}

// One model round-trip with backoff. A rate limit (429) or transient 5xx is
// retried; a 400 (JSON-mode rejected) falls back to lenient parsing once.
// Backoff stays within the cron's per-request time budget.
async function callModel(apiUrl: string, apiKey: string, model: string, prompt: string): Promise<any> {
  const backoff = [4000, 9000, 18000]
  for (let attempt = 0; ; attempt++) {
    try {
      return await chatCompletion(apiUrl, apiKey, model, prompt, true)
    } catch (e) {
      const status = (e as { status?: number })?.status
      if (status === 400) {
        return await chatCompletion(apiUrl, apiKey, model, prompt, false)
      }
      const transient = status === 429 || status === undefined || (status >= 500)
      if (transient && attempt < backoff.length) {
        await sleep(backoff[attempt])
        continue
      }
      throw e
    }
  }
}

// Build the Arabic payload from raw model output. No English fallback — the
// model's Arabic must stand on its own. Empty optional fields are allowed; a
// non-empty source field that returns empty is caught by collectArabicErrors.
function buildPayloadFromModel(parsed: any): TranslationPayload {
  return {
    title: clean(parsed?.title),
    description: clean(parsed?.description),
    requirements: clean(parsed?.requirements),
    whoFor: clean(parsed?.whoFor),
    whatLearn: clean(parsed?.whatLearn),
    category: clean(parsed?.category),
    metaTitle: clean(parsed?.metaTitle),
    metaDescription: truncateForMeta(clean(parsed?.metaDescription)),
  }
}

// Acronyms / brand names that must stay in English (wrapped in Arabic context).
const KEEP_ENGLISH = 'AWS, Cisco, CCNP, CCNA, CISA, CompTIA, Python, React, Vue.js, SQL, API, Adobe, Photoshop, Excel, PowerPoint, AI, ChatGPT, PMP, Udemy'

function buildArabicPrompt(input: TranslationPayload): string {
  return [
    'Rewrite the following Udemy course metadata as fluent, natural Arabic for Arabic users browsing FREE online courses.',
    'This is localization/copywriting, NOT literal translation.',
    '',
    'STYLE:',
    '- Produce natural Arabic that sounds like a real Arabic course title and clear Arabic educational copy.',
    '- Rewrite for meaning, not word-for-word. Preserve facts; never invent new ones.',
    `- Keep certification names, product names and technical acronyms in English when that is natural: ${KEEP_ENGLISH}.`,
    '- Add light Arabic context around English acronyms/certifications (e.g. "شهادة Cisco CCNP في أمن الشبكات").',
    '- Keep descriptions concise and useful: roughly 2–4 sentences. Do not pad or repeat.',
    '',
    'AVOID these literal / machine-translation phrasings:',
    '- دبلومة، دبلومة محترفة  → use: دبلوم، دبلوم مهني',
    '- اختبارات ممارسة / امتحانات ممارسة → use: اختبارات تدريبية',
    '- ماستر كلاس → use: دورة متقدمة',
    '- صنع بسيط → use: تبسيط',
    '- إدارة المكتب (for Office Management) → use: إدارة المكاتب',
    '- Never output the raw English title as if it were Arabic.',
    '',
    'GOOD EXAMPLES (English → natural Arabic):',
    '- "Professional Diploma in Office Management" → "دبلوم مهني في إدارة المكاتب"',
    '- "Cisco CCNP 350-701 Practice Tests | 700 Qs | SCOR Security" → "اختبارات تدريبية لشهادة Cisco CCNP 350-701 في أمن الشبكات"',
    '- "AI Made Simple for Kids: Fun Learning with Technology" → "تبسيط الذكاء الاصطناعي للأطفال بأسلوب ممتع"',
    '- "PowerPoint Business Presentations with ChatGPT Generative AI" → "إنشاء عروض PowerPoint للأعمال باستخدام ChatGPT والذكاء الاصطناعي التوليدي"',
    '- "Adobe Photoshop CC Mastery Class: Basic to Pro + AI" → "احتراف Adobe Photoshop CC من الأساسيات إلى المستوى المتقدم مع أدوات الذكاء الاصطناعي"',
    '',
    'OUTPUT:',
    '- Return ONLY a JSON object with EXACTLY these keys: title, description, requirements, whoFor, whatLearn, category, metaTitle, metaDescription.',
    '- Every non-empty source field must come back as natural Arabic. If a source field is empty, return an empty string.',
    '- No markdown, no commentary, no extra keys.',
    '',
    'Input JSON:',
    JSON.stringify(input),
  ].join('\n')
}

// Repair pass: re-ask the model to rewrite the whole JSON naturally in Arabic,
// given the original course, the rejected attempt, and the specific errors.
async function repairArabicPayload(
  cfg: { apiUrl: string; apiKey: string; model: string },
  input: TranslationPayload,
  bad: TranslationPayload,
  errors: string[],
): Promise<TranslationPayload> {
  const prompt = [
    'Your previous Arabic localization of this course was REJECTED by a quality gate.',
    'Rewrite the ENTIRE JSON again as fluent, natural Arabic — fix the problems and keep the same keys.',
    '',
    'Problems to fix:',
    ...errors.map((e) => `- ${e}`),
    '',
    'Rules:',
    '- Rewrite the ENTIRE JSON as a professional Arabic course listing.',
    '- Remove ANY Chinese, Japanese, Korean, Cyrillic, malformed, or strange Unicode characters. Use ONLY Arabic text plus necessary English technical names/acronyms.',
    '- Fix malformed Arabic words and any token where Arabic letters are glued to Latin letters.',
    '- Fix machine-translated sentences; write natural Arabic, not literal structure copied from English.',
    `- Localization, not literal translation. Keep these in English when natural: ${KEEP_ENGLISH}.`,
    '- Make requirements / whoFor / whatLearn clear and natural (short Arabic phrases).',
    '- description: 2–3 concise Arabic sentences. Do not pad.',
    '- Avoid: دبلومة، اختبارات ممارسة، ماستر كلاس، صنع بسيط. Use: دبلوم/دبلوم مهني، اختبارات تدريبية، دورة متقدمة، تبسيط.',
    '- Always put a space between Arabic words and English technical terms. Examples:',
    '    Write "استخدم ChatGPT", not "استخدمChatGPT".',
    '    Write "تعلم Python", not "تعلمPython".',
    '    Write "واجهة API", not "واجهةAPI".',
    '  Never attach Arabic letters directly to an English technical term.',
    '- Return ONLY a JSON object with exactly: title, description, requirements, whoFor, whatLearn, category, metaTitle, metaDescription.',
    '',
    'Original English course (source of truth):',
    JSON.stringify(input),
    '',
    'Previous Arabic attempt (rejected — improve it, do not repeat its mistakes):',
    JSON.stringify(bad),
  ].join('\n')

  const parsed = await callModel(cfg.apiUrl, cfg.apiKey, cfg.model, prompt)
  return normalizeArabicPayload(buildPayloadFromModel(parsed))
}

async function translateWithModel(course: CourseLike): Promise<TranslationPayload> {
  const cfg = translationConfig()

  const raw = originalPayload(course)
  // Full translation, but bound the long fields to keep token usage (and
  // latency) sane. Descriptions are also asked to stay concise in the prompt.
  const input: TranslationPayload = {
    ...raw,
    description: cap(raw.description, 4000),
    requirements: cap(raw.requirements, 2000),
    whoFor: cap(raw.whoFor, 2000),
    whatLearn: cap(raw.whatLearn, 2000),
  }

  // 1) First pass.
  const firstParsed = await callModel(cfg.apiUrl, cfg.apiKey, cfg.model, buildArabicPrompt(input))
  let payload = normalizeArabicPayload(buildPayloadFromModel(firstParsed))
  let errors = collectArabicErrors(input, payload)
  if (errors.length === 0) return payload

  // 2) Repair pass — re-ask the model with the failure reasons instead of
  //    dropping the course because the first output was literal/partial English.
  payload = await repairArabicPayload(cfg, input, payload, errors)
  errors = collectArabicErrors(input, payload)
  if (errors.length === 0) return payload

  throw new Error(`Arabic translation failed quality gate after repair: ${errors.join(', ')}`)
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
    // A provider 429 that survived callModel's backoff is only a temporary rate
    // limit: keep the row 'pending' (retryable, never counted in arFailed) and
    // rethrow so the caller can stop the batch and let the cooldown clear.
    if (isRateLimitError(err)) {
      await (db as any).courseTranslation.update({
        where: { courseId_locale: { courseId: course.id, locale: 'ar' } },
        data: { status: 'pending', error: 'rate_limited_429' },
      })
      throw err
    }
    // Any other failure marks the row 'failed' and stamps updatedAt=now.
    // getCoursesMissingTranslation then skips it for FAILED_BACKOFF_MS (30m), so
    // a failing course retries later and never blocks the queue.
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
//
// For Arabic the selection is tiered (missing → stale pending → old failed) and
// each tier is queried directly from the DB, so older missing rows are never
// starved by a window full of newer translated/failed rows. Failed rows only
// re-enter after FAILED_BACKOFF and only once no untranslated course remains,
// so one repeatedly-failing course can never block the queue.
const FAILED_BACKOFF_MS = 30 * 60 * 1000
const PENDING_BACKOFF_MS = 10 * 60 * 1000

export async function getCoursesMissingTranslation(locale: Locale, limit: number) {
  const take = Math.min(Math.max(limit, 1), 20)

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
      if (isRateLimitError(err)) {
        // Provider rate limit: report it so the Oracle catchup cooldown can see
        // the 429, and stop starting more courses — they would all hit it too.
        results.push({ courseId: course.id, title: course.title, status: 'rate_limited', error: 'Translation API failed: 429' })
        break
      }
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
    // For English: safe to fall back to original English fields.
    return {
      ...course,
      locale,
      localizedSlug: course.slug,
      localizedTitle: course.title,
      localizedDescription: course.description || '',
      localizedRequirements: course.requirements || '',
      localizedWhoFor: course.whoFor || '',
      localizedWhatLearn: course.whatLearn || '',
      localizedCategory: course.category,
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
