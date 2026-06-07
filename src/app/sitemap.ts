import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.learn-plus.uk'

// Dynamic sitemap: homepage + every published course page.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let courses: { slug: string; updatedAt: Date }[] = []
  try {
    courses = await db.course.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
      orderBy: { scrapedAt: 'desc' },
      take: 5000,
    })
  } catch {
    courses = []
  }

  const courseEntries: MetadataRoute.Sitemap = courses.map((c) => ({
    url: `${BASE}/course/${c.slug}`,
    lastModified: c.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  const staticEntries: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), changeFrequency: 'hourly', priority: 1 },
    { url: `${BASE}/about`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ]

  return [...staticEntries, ...courseEntries]
}
