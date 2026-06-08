import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'
import { PUBLISHABLE_STATUSES } from '@/lib/course-translations'

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.learn-plus.uk'

// Dynamic sitemap: static pages + every published course page, including the
// localized /en and /ar variants. Arabic course URLs are only listed when an
// Arabic translation exists (we don't advertise English-fallback /ar pages).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let courses: { id: string; slug: string; updatedAt: Date }[] = []
  try {
    courses = await db.course.findMany({
      where: { isPublished: true },
      select: { id: true, slug: true, updatedAt: true },
      orderBy: { scrapedAt: 'desc' },
      take: 5000,
    })
  } catch {
    courses = []
  }

  // Per-locale translated slugs, keyed by courseId. Guarded — before the i18n
  // tables exist this stays empty and we fall back to original slugs / en only.
  const enSlug = new Map<string, string>()
  const arSlug = new Map<string, string>()
  try {
    const rows = await (db as any).courseTranslation.findMany({
      where: { status: { in: PUBLISHABLE_STATUSES as unknown as string[] }, courseId: { in: courses.map((c) => c.id) } },
      select: { courseId: true, locale: true, slug: true },
    })
    for (const r of rows as Array<{ courseId: string; locale: string; slug: string }>) {
      if (r.locale === 'en') enSlug.set(r.courseId, r.slug)
      else if (r.locale === 'ar') arSlug.set(r.courseId, r.slug)
    }
  } catch {
    /* i18n tables not ready */
  }

  const courseEntries: MetadataRoute.Sitemap = []
  for (const c of courses) {
    // Legacy English route (kept for backward compatibility).
    courseEntries.push({
      url: `${BASE}/course/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: 'weekly',
      priority: 0.7,
    })
    // English localized route.
    courseEntries.push({
      url: `${BASE}/en/course/${enSlug.get(c.id) || c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: 'weekly',
      priority: 0.7,
    })
    // Arabic localized route — only when an Arabic translation exists.
    const ar = arSlug.get(c.id)
    if (ar) {
      courseEntries.push({
        url: `${BASE}/ar/course/${ar}`,
        lastModified: c.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.7,
      })
    }
  }

  const staticEntries: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), changeFrequency: 'hourly', priority: 1 },
    { url: `${BASE}/en`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE}/ar`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE}/about`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ]

  return [...staticEntries, ...courseEntries]
}
