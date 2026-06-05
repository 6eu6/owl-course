import { db } from '@/lib/db';

// Course operations
export async function getAllCourses(options: {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  source?: string;
  published?: boolean;
}) {
  const { page = 1, limit = 12, search, category, source, published = true } = options;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (published !== undefined) where.isPublished = published;
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
      { instructor: { contains: search } },
    ];
  }
  if (category) where.category = category;
  if (source) where.source = source;

  const [courses, total] = await Promise.all([
    db.course.findMany({
      where,
      orderBy: { scrapedAt: 'desc' },
      skip,
      take: limit,
    }),
    db.course.count({ where }),
  ]);

  return { courses, total };
}

export async function getCourseBySlug(slug: string) {
  return db.course.findUnique({ where: { slug, isPublished: true } });
}

export async function getRelatedCourses(category: string, excludeSlug: string, limit: number = 4) {
  return db.course.findMany({
    where: { category, slug: { not: excludeSlug }, isPublished: true },
    take: limit,
    orderBy: { scrapedAt: 'desc' },
  });
}

export async function getCourseByUrl(udemyUrl: string) {
  return db.course.findUnique({ where: { udemyUrl } });
}

export async function createCourse(data: {
  title: string;
  slug: string;
  description?: string;
  instructor?: string;
  category?: string;
  imageUrl?: string;
  udemyUrl: string;
  source: string;
}) {
  return db.course.create({ data });
}

export async function getAllCategories() {
  const courses = await db.course.findMany({
    where: { isPublished: true },
    select: { category: true },
    distinct: ['category'],
  });
  return courses.map(c => c.category);
}

export async function countCoursesBySource() {
  const results = await db.course.groupBy({
    by: ['source'],
    _count: { source: true },
  });
  return results.map(r => ({ _id: r.source, count: r._count.source }));
}

export async function countCourses(where?: Record<string, unknown>) {
  return db.course.count({ where });
}

export async function updateCourse(id: string, data: Record<string, unknown>) {
  return db.course.update({ where: { id }, data });
}

export async function markCourseTelegramPosted(id: string) {
  return db.course.update({
    where: { id },
    data: { telegramPosted: true, telegramPostedAt: new Date() },
  });
}

export async function getUnpostedCourses(limit: number = 5) {
  return db.course.findMany({
    where: { isPublished: true, telegramPosted: false },
    orderBy: { scrapedAt: 'desc' },
    take: limit,
  });
}

// Settings operations
export async function getSetting(key: string): Promise<string | null> {
  const setting = await db.setting.findUnique({ where: { id: key } });
  return setting?.value || null;
}

export async function setSetting(key: string, value: string | boolean | number) {
  return db.setting.upsert({
    where: { id: key },
    update: { value: String(value) },
    create: { id: key, value: String(value) },
  });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const settings = await db.setting.findMany();
  const result: Record<string, string> = {};
  for (const s of settings) {
    result[s.id] = s.value;
  }
  return result;
}

// Telegram settings (stored as JSON in a single Setting row)
export async function getTelegramSettings() {
  const raw = await getSetting('telegram');
  if (!raw) {
    return {
      bot_token: '',
      channels: [{ name: 'القناة الرئيسية', id: '', active: true }],
      auto_post: false,
      message_template: '🔰 {title}\n\n👨‍🏫 {instructor}\n⭐ {rating}\n🎓 {students_count} students\n\n🔗 {link}',
    };
  }
  try {
    return JSON.parse(raw);
  } catch {
    return {
      bot_token: '',
      channels: [{ name: 'القناة الرئيسية', id: '', active: true }],
      auto_post: false,
      message_template: '{title}\n{link}',
    };
  }
}

export async function saveTelegramSettings(settings: Record<string, unknown>) {
  await setSetting('telegram', JSON.stringify(settings));
}

// Telegram Messages
export async function logTelegramMessage(data: {
  courseId?: string;
  courseTitle: string;
  channels: string[];
  status: string;
}) {
  return db.telegramMessage.create({
    data: {
      courseId: data.courseId,
      courseTitle: data.courseTitle,
      channels: JSON.stringify(data.channels),
      status: data.status,
    },
  });
}

export async function getRecentTelegramMessages(limit: number = 10) {
  const messages = await db.telegramMessage.findMany({
    orderBy: { sentAt: 'desc' },
    take: limit,
  });
  return messages.map(m => ({
    id: m.id,
    course_title: m.courseTitle,
    channels: JSON.parse(m.channels || '[]'),
    status: m.status,
    sent_at: m.sentAt,
  }));
}

// Scraper Logs
export async function logScraperRun(type: string, results: Record<string, unknown>) {
  return db.scraperLog.create({
    data: {
      type,
      results: JSON.stringify(results),
    },
  });
}

export async function getRecentScraperLogs(limit: number = 10) {
  const logs = await db.scraperLog.findMany({
    orderBy: { timestamp: 'desc' },
    take: limit,
  });
  return logs.map(l => ({
    id: l.id,
    type: l.type,
    results: JSON.parse(l.results || '{}'),
    timestamp: l.timestamp,
  }));
}
