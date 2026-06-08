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
// Two-step pending-translation finder (no `every` — avoids the vacuous-truth
// bug where courses with zero TelegramPost rows were incorrectly excluded).
// ---------------------------------------------------------------------------

type Channel = {
  id: string;
  name?: string;
  active: boolean;
  language?: string;
};

type PendingTranslation = {
  translation: any;
  course: any;
  pendingChannels: Channel[];
};

async function findPendingTranslations(
  locale: Locale,
  activeChannels: Channel[],
  limit: number
): Promise<PendingTranslation[]> {
  const channelIds = activeChannels.map((c) => c.id);

  const candidates = await (db as any).courseTranslation.findMany({
    where: {
      locale,
      status: 'translated',
      course: { isPublished: true },
    },
    include: { course: true },
    orderBy: { course: { scrapedAt: 'desc' } },
    take: Math.max(limit * 30, 30),
  });

  const selected: PendingTranslation[] = [];

  for (const tr of candidates) {
    const course = tr.course;
    if (!course) continue;

    const sentRows = await (db as any).telegramPost.findMany({
      where: {
        courseId: course.id,
        locale,
        channelId: { in: channelIds },
        status: 'sent',
      },
      select: { channelId: true },
    });

    const sentIds = new Set(
      sentRows.map((row: { channelId: string }) => row.channelId)
    );

    const pendingChannels = activeChannels.filter((channel) => !sentIds.has(channel.id));

    if (pendingChannels.length > 0) {
      selected.push({ translation: tr, course, pendingChannels });
      if (selected.length >= limit) break;
    }
  }

  return selected;
}

// GET /api/cron/post?secret=CRON_SECRET&locale=en|ar&limit=1&dryRun=1
// Post-only drainer (no scraping). Locale-aware: English channels receive /en
// course links and Arabic channels receive only translated /ar course links.
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

    // Two-step selection — no `every` filter.
    let pending: PendingTranslation[];
    try {
      pending = await findPendingTranslations(locale, activeChannels, limit);
    } catch (error) {
      if (isMissingI18nTable(error)) {
        return NextResponse.json({
          success: true,
          locale,
          posted: 0,
          remaining: 0,
          message: 'i18n tables not ready — run /api/cron/i18n-bootstrap then /api/cron/translate first',
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
          title: item.translation.title,
          slug: item.translation.slug,
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
      const tr = item.translation;
      const c = item.course;
      const pendingChannels = item.pendingChannels;

      const data = {
        title: tr.title,
        instructor: c.instructor,
        category: tr.category || c.category,
        rating: c.rating,
        students_count: c.studentsCount,
        original_price: c.originalPrice,
        language: c.language,
        duration: c.duration,
        udemy_url: c.couponUrl || c.udemyUrl || '',
        slug: tr.slug,
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
          courseTitle: tr.title,
          channels: result.channels,
          status: `sent:${locale}`,
        });
      } else {
        failed.push(tr.title);
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

    // Count remaining using the same two-step approach — no `every`.
    const remainingPreview = await findPendingTranslations(locale, activeChannels, 1);
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
