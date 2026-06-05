import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

// ============================================
// Course Operations
// ============================================

export interface CourseQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  source?: string;
  published?: boolean;
  sort?: string;
}

export async function getAllCourses(options: CourseQueryOptions) {
  const { page = 1, limit = 12, search, category, source, published = true, sort } = options;
  const skip = (page - 1) * limit;

  const where: Prisma.CourseWhereInput = {};
  if (published !== undefined) where.isPublished = published;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { instructor: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (category) where.category = category;
  if (source) where.source = source;

  let orderBy: Prisma.CourseOrderByWithRelationInput = { scrapedAt: 'desc' };
  if (sort === 'rating') orderBy = { rating: 'desc' };
  else if (sort === 'title') orderBy = { title: 'asc' };
  else if (sort === 'oldest') orderBy = { scrapedAt: 'asc' };
  else if (sort === 'students') orderBy = { studentsCount: 'desc' };

  const [courses, total] = await Promise.all([
    db.course.findMany({ where, orderBy, skip, take: limit }),
    db.course.count({ where }),
  ]);

  return { courses, total };
}

export async function getCourseBySlug(slug: string) {
  return db.course.findUnique({ where: { slug } });
}

export async function getCourseByUrl(udemyUrl: string) {
  return db.course.findUnique({ where: { udemyUrl } });
}

export async function getRelatedCourses(category: string, excludeSlug: string, limit: number = 4) {
  return db.course.findMany({
    where: { category, slug: { not: excludeSlug }, isPublished: true },
    take: limit,
    orderBy: { scrapedAt: 'desc' },
  });
}

export async function createCourse(data: Prisma.CourseCreateInput) {
  return db.course.create({ data });
}

export async function createCourseIfNotExists(data: {
  title: string;
  slug: string;
  description?: string;
  instructor?: string;
  category?: string;
  imageUrl?: string;
  udemyUrl: string;
  source: string;
  rating?: number | null;
  studentsCount?: number | null;
  originalPrice?: string | null;
  language?: string | null;
  duration?: string | null;
  requirements?: string;
  whoFor?: string;
  whatLearn?: string;
  lastUpdated?: string | null;
  couponCode?: string | null;
  couponUrl?: string | null;
  couponExpiresAt?: Date | null;
  isFreeForever?: boolean;
  sourceDetail?: string;
  scrapeRunId?: string;
  couponVerified?: boolean;
}): Promise<{ created: boolean; course?: Prisma.PromiseReturnType<typeof db.course.create> }> {
  // Check for duplicate by udemyUrl
  const existing = await getCourseByUrl(data.udemyUrl);
  if (existing) return { created: false };

  // Try to create, handle slug uniqueness
  try {
    const course = await db.course.create({ data });
    return { created: true, course };
  } catch (err: unknown) {
    const prismaErr = err as { code?: string };
    if (prismaErr?.code === 'P2002') {
      // Slug collision - add timestamp suffix
      const course = await db.course.create({
        data: { ...data, slug: `${data.slug}-${Date.now()}` },
      });
      return { created: true, course };
    }
    throw err;
  }
}

export async function getAllCategories() {
  const results = await db.course.groupBy({
    by: ['category'],
    where: { isPublished: true },
    _count: { category: true },
  });
  return results.map(r => ({ name: r.category, count: r._count.category }));
}

export async function countCourses(where?: Prisma.CourseWhereInput) {
  return db.course.count({ where });
}

export async function countCoursesBySource() {
  const results = await db.course.groupBy({
    by: ['source'],
    _count: { source: true },
  });
  return results.map(r => ({ _id: r.source, count: r._count.source }));
}

export async function countNewToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return db.course.count({
    where: { createdAt: { gte: today } },
  });
}

export async function updateCourse(id: string, data: Prisma.CourseUpdateInput) {
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

// ============================================
// Coupon Upsert - Update existing course coupon
// ============================================

export async function upsertCourseCoupon(
  udemyUrl: string,
  data: {
    couponCode: string;
    couponUrl: string;
    couponExpiresAt?: Date | null;
    couponVerified?: boolean;
  }
): Promise<{ updated: boolean }> {
  // Find course by udemyUrl (normalized - without couponCode param)
  try {
    const urlObj = new URL(udemyUrl);
    urlObj.searchParams.delete('couponCode');
    urlObj.searchParams.delete('coupon');
    const normalizedUrl = urlObj.toString().replace(/\?$/, '');

    // Try to find by the normalized URL
    const existing = await db.course.findFirst({
      where: {
        OR: [
          { udemyUrl: normalizedUrl },
          { udemyUrl: { contains: urlObj.pathname } },
        ],
      },
    });

    if (!existing) {
      return { updated: false };
    }

    // Update the course with new coupon data
    await db.course.update({
      where: { id: existing.id },
      data: {
        couponCode: data.couponCode,
        couponUrl: data.couponUrl,
        couponExpiresAt: data.couponExpiresAt ?? null,
        couponVerified: data.couponVerified ?? false,
        scrapedAt: new Date(),
      },
    });

    return { updated: true };
  } catch {
    return { updated: false };
  }
}

// ============================================
// Settings Operations
// ============================================

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

export async function getAdminPassword(): Promise<string> {
  const password = await getSetting('admin_password');
  return password || 'owl2024';
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const adminPassword = await getAdminPassword();
  return password === adminPassword;
}

// ============================================
// Telegram Settings (JSON in Setting row)
// ============================================

export interface TelegramSettingsConfig {
  bot_token: string;
  channels: Array<{ name: string; id: string; active: boolean }>;
  auto_post: boolean;
  message_template: string;
}

export async function getTelegramSettings(): Promise<TelegramSettingsConfig> {
  const raw = await getSetting('telegram');
  if (!raw) {
    return {
      bot_token: '',
      channels: [{ name: 'Main Channel', id: '', active: true }],
      auto_post: false,
      message_template: '{title}\n\nInstructor: {instructor}\nRating: {rating}\nStudents: {students_count}\n\n{link}',
    };
  }
  try {
    return JSON.parse(raw);
  } catch {
    return {
      bot_token: '',
      channels: [{ name: 'Main Channel', id: '', active: true }],
      auto_post: false,
      message_template: '{title}\n{link}',
    };
  }
}

export async function saveTelegramSettings(settings: TelegramSettingsConfig) {
  await setSetting('telegram', JSON.stringify(settings));
}

// ============================================
// Telegram Messages
// ============================================

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
    sent_at: m.sentAt.toISOString(),
  }));
}

// ============================================
// Scraper Logs
// ============================================

export interface ScraperLogEntry {
  source: string;
  status: string;
  newCount: number;
  dupCount: number;
  errCount: number;
  message: string;
  duration: number;
}

export async function logScraperRun(entry: ScraperLogEntry) {
  return db.scraperLog.create({
    data: {
      source: entry.source,
      status: entry.status,
      newCount: entry.newCount,
      dupCount: entry.dupCount,
      errCount: entry.errCount,
      message: entry.message,
      duration: entry.duration,
    },
  });
}

export async function getRecentScraperLogs(limit: number = 20) {
  return db.scraperLog.findMany({
    orderBy: { timestamp: 'desc' },
    take: limit,
  });
}

export async function getLastScrapeTime(): Promise<Date | null> {
  const lastLog = await db.scraperLog.findFirst({
    orderBy: { timestamp: 'desc' },
    select: { timestamp: true },
  });
  return lastLog?.timestamp || null;
}

// ============================================
// Database Cleanup - Remove incorrect course data
// ============================================

export async function cleanupInvalidCourses(): Promise<{
  removedNoCoupon: number;
  removedFakeFree: number;
  removedDuplicates: number;
  totalRemoved: number;
}> {
  // 1. Remove courses with no valid coupon code (DIRECT, FREE, empty, < 4 chars)
  const badCouponCodes = ['', 'DIRECT', 'FREE'];
  const noCouponRemoved = await db.course.deleteMany({
    where: {
      OR: [
        { couponCode: { in: badCouponCodes } },
        { couponCode: { isEmpty: true } },
        { couponCode: 'DIRECT' },
      ],
    },
  });

  // 2. Remove courses incorrectly marked as free forever
  // (Only genuinely free Udemy courses should have this flag)
  const fakeFreeRemoved = await db.course.deleteMany({
    where: {
      isFreeForever: true,
      // These should not have been marked as free forever
      couponCode: { not: '' },
    },
  });

  // 3. Remove duplicates by title
  const allCourses = await db.course.findMany({
    select: { id: true, title: true },
  });
  const seenTitles = new Map<string, string>();
  const duplicateIds: string[] = [];
  for (const course of allCourses) {
    const norm = course.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seenTitles.has(norm)) {
      duplicateIds.push(course.id);
    } else {
      seenTitles.set(norm, course.id);
    }
  }
  let dupRemoved = 0;
  if (duplicateIds.length > 0) {
    const dupResult = await db.course.deleteMany({
      where: { id: { in: duplicateIds } },
    });
    dupRemoved = dupResult.count;
  }

  const totalRemoved = noCouponRemoved.count + fakeFreeRemoved.count + dupRemoved;

  return {
    removedNoCoupon: noCouponRemoved.count,
    removedFakeFree: fakeFreeRemoved.count,
    removedDuplicates: dupRemoved,
    totalRemoved,
  };
}

export async function purgeAllCourses(): Promise<{ removed: number }> {
  const count = await db.course.count();
  await db.course.deleteMany();
  return { removed: count };
}
