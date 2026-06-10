import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { normalizeLocale, type Locale } from '@/lib/i18n';

// Prisma raises P2021 when a table referenced by a query does not exist yet.
// During the i18n rollout the CourseTranslation / TelegramPost tables may not
// have been created. We treat that as a safe no-op instead of a hard failure
// so an Oracle cron hit can never break or spam errors.
function isMissingI18nTable(error: unknown): boolean {
  const e = error as { code?: string; message?: string };
  if (e?.code === 'P2021') return true;
  const msg = String(e?.message || error || '');
  return /does not exist/i.test(msg) && /(CourseTranslation|TelegramPost)/.test(msg);
}

// ---------------------------------------------------------------------------
// Source of each locale's posting content:
//   - English (en): the scraped Course rows directly. No CourseTranslation(en)
//     is required — a course is postable to /en the moment it is scraped.
//   - Arabic  (ar): CourseTranslation(ar, status='translated') only.
//
// Both share TelegramPost(courseId, locale, channelId) for per-channel dedup,
// and a uniform PendingPost shape so the posting loop stays identical.
// ---------------------------------------------------------------------------

type Channel = {
  id: string;
  name: string;
  active: boolean;
  language: string;
};

type PendingPost = {
  course: any;
  title: string;
  slug: string;
  category: string;
  pendingChannels: Channel[];
};

// Channels that have NOT yet received this course for this locale.
async function channelsNotYetSent(
  courseId: string,
  locale: Locale,
  activeChannels: Channel[],
  channelIds: string[],
): Promise<Channel[]> {
  const sentRows = await (db as any).telegramPost.findMany({
    where: { courseId, locale, channelId: { in: channelIds }, status: 'sent' },
    select: { channelId: true },
  });
  const sentIds = new Set(sentRows.map((row: { channelId: string }) => row.channelId));
  return activeChannels.filter((channel) => !sentIds.has(channel.id));
}

// English: select straight from published Course rows (newest first).
async function findPendingEnglish(activeChannels: Channel[], limit: number): Promise<PendingPost[]> {
  const channelIds = activeChannels.map((c) => c.id);
  const candidates = await db.course.findMany({
    where: { isPublished: true },
    orderBy: { scrapedAt: 'desc' },
    take: Math.max(limit * 30, 30),
  });

  const selected: PendingPost[] = [];
  for (const course of candidates) {
    const pendingChannels = await channelsNotYetSent(course.id, 'en', activeChannels, channelIds);
    if (pendingChannels.length > 0) {
      selected.push({ course, title: course.title, slug: course.slug, category: course.category, pendingChannels });
      if (selected.length >= limit) break;
    }
  }
  return selected;
}

// Arabic: select from translated Arabic rows only (two-step, no `every` filter).
async function findPendingArabic(activeChannels: Channel[], limit: number): Promise<PendingPost[]> {
  const channelIds = activeChannels.map((c) => c.id);
  const candidates = await (db as any).courseTranslation.findMany({
    where: { locale: 'ar', status: 'translated', course: { isPublished: true } },
    include: { course: true },
    orderBy: { course: { scrapedAt: 'desc' } },
    take: Math.max(limit * 30, 30),
  });

  const selected: PendingPost[] = [];
  for (const tr of candidates) {
    const course = tr.course;
    if (!course) continue;
    const pendingChannels = await channelsNotYetSent(course.id, 'ar', activeChannels, channelIds);
    if (pendingChannels.length > 0) {
      selected.push({ course, title: tr.title, slug: tr.slug, category: tr.category || course.category, pendingChannels });
      if (selected.length >= limit) break;
    }
  }
  return selected;
}

function findPending(locale: Locale, activeChannels: Channel[], limit: number): Promise<PendingPost[]> {
  return locale === 'ar'
    ? findPendingArabic(activeChannels, limit)
    : findPendingEnglish(activeChannels, limit);
}

// GET /api/cron/post?secret=CRON_SECRET&locale=en|ar&limit=1&dryRun=1
// Post-only drainer (no scraping). Locale-aware: English channels post /en links
// from Course rows; Arabic channels post only translated /ar course links.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret') || '';
    const expected = process.env.CRON_SECRET || process.env.ADMIN_PASSWORD || '';
    if (expected && secret !== expected) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const locale: Locale = normalizeLocale(searchParams.get('locale') || 'en');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '1'), 1), 5);
    // dryRun=1 selects what WOULD be posted without sending to Telegram or
    // writing TelegramPost rows. Safe to call against production.
    const dryRun = ['1', 'true', 'yes'].includes((searchParams.get('dryRun') || '').toLowerCase());

    const {
      getTelegramSettings,
      logTelegramMessage,
    } = await import('@/lib/queries');
    const { postCourseToTelegramChannels } = await import('@/lib/telegram');

    const settings = await getTelegramSettings();
    const token = process.env.TELEGRAM_BOT_TOKEN || settings.bot_token;
    const activeChannels: Channel[] = (settings.channels || [])
      .filter((c: any) => c.active && c.id && normalizeLocale(c.language) === locale);

    if (!token) return NextResponse.json({ success: true, locale, posted: 0, error: 'TELEGRAM_BOT_TOKEN not set' });
    if (activeChannels.length === 0) return NextResponse.json({ success: true, locale, posted: 0, error: `no active ${locale} channels` });

    // Per-locale source selection — no `every` filter.
    let pending: PendingPost[];
    try {
      pending = await findPending(locale, activeChannels, limit);
    } catch (error) {
      if (isMissingI18nTable(error)) {
        return NextResponse.json({
          success: true,
          locale,
          posted: 0,
          remaining: 0,
          message: 'TelegramPost/CourseTranslation table not ready — apply the Prisma schema (npm run db:push) first',
        });
      }
      throw error;
    }

    if (pending.length === 0) {
      return NextResponse.json({ success: true, locale, posted: 0, remaining: 0, message: 'all caught up' });
    }

    // ---- dryRun: return wouldPost without touching Telegram or DB ----
    if (dryRun) {
      return NextResponse.json({
        success: true,
        locale,
        dryRun: true,
        posted: 0,
        wouldPost: pending.map((item) => ({
          courseId: item.course.id,
          title: item.title,
          slug: item.slug,
          channels: item.pendingChannels.map((channel) => channel.name || channel.id),
        })),
        channels: activeChannels.map((channel) => channel.name || channel.id),
        timestamp: new Date().toISOString(),
      });
    }

    // ---- Real posting loop ----
    let posted = 0;
    const failed: string[] = [];

    for (const item of pending) {
      const c = item.course;
      const pendingChannels = item.pendingChannels;

      const data = {
        title: item.title,
        instructor: c.instructor,
        category: item.category,
        rating: c.rating,
        students_count: c.studentsCount,
        original_price: c.originalPrice,
        language: c.language,
        duration: c.duration,
        udemy_url: c.couponUrl || c.udemyUrl || '',
        slug: item.slug,
        locale,
      };

      const result = await postCourseToTelegramChannels(
        data,
        settings as unknown as Record<string, unknown>,
        pendingChannels
      );

      if (result.success) {
        posted++;
        for (const channelId of result.channelIds) {
          await (db as any).telegramPost.upsert({
            where: { courseId_locale_channelId: { courseId: c.id, locale, channelId } },
            update: { status: 'sent', error: null, sentAt: new Date() },
            create: { courseId: c.id, locale, channelId, status: 'sent' },
          });
        }

        await logTelegramMessage({
          courseId: c.id,
          courseTitle: item.title,
          channels: result.channels,
          status: `sent:${locale}`,
        });
      } else {
        failed.push(item.title);
        for (const channel of pendingChannels) {
          await (db as any).telegramPost.upsert({
            where: {
              courseId_locale_channelId: {
                courseId: c.id,
                locale,
                channelId: channel.id,
              },
            },
            update: {
              status: 'failed',
              error: 'sendMessage failed',
              sentAt: new Date(),
            },
            create: {
              courseId: c.id,
              locale,
              channelId: channel.id,
              status: 'failed',
              error: 'sendMessage failed',
            },
          });
        }
      }
    }

    // Count remaining using the same selection.
    const remainingPreview = await findPending(locale, activeChannels, 1);
    const remaining = remainingPreview.length;

    return NextResponse.json({
      success: true,
      locale,
      posted,
      failed: failed.length,
      remaining,
      channels: activeChannels.map((channel) => channel.name || channel.id),
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
