import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { normalizeLocale, type Locale } from '@/lib/i18n';

// GET /api/cron/post?secret=CRON_SECRET&locale=en|ar
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

    const {
      getTelegramSettings,
      logTelegramMessage,
    } = await import('@/lib/queries');
    const { postCourseToTelegramChannels } = await import('@/lib/telegram');

    const settings = await getTelegramSettings();
    const token = process.env.TELEGRAM_BOT_TOKEN || settings.bot_token;
    const activeChannels = (settings.channels || [])
      .filter((c) => c.active && c.id && normalizeLocale(c.language) === locale);

    if (!token) return NextResponse.json({ success: true, locale, posted: 0, error: 'TELEGRAM_BOT_TOKEN not set' });
    if (activeChannels.length === 0) return NextResponse.json({ success: true, locale, posted: 0, error: `no active ${locale} channels` });

    const channelIds = activeChannels.map((c) => c.id);

    // Pick courses with ready translation for this locale and at least one active
    // locale channel that has not received the course yet.
    const translations = await (db as any).courseTranslation.findMany({
      where: {
        locale,
        status: 'translated',
        course: { isPublished: true },
        NOT: {
          course: {
            telegramPosts: {
              every: { locale, channelId: { in: channelIds }, status: 'sent' },
            },
          },
        },
      },
      include: { course: true },
      orderBy: { course: { scrapedAt: 'desc' } },
      take: limit,
    });

    if (translations.length === 0) {
      return NextResponse.json({ success: true, locale, posted: 0, remaining: 0, message: 'all caught up' });
    }

    let posted = 0;
    const failed: string[] = [];

    for (const tr of translations) {
      const c = tr.course;
      const alreadySentRows = await (db as any).telegramPost.findMany({
        where: { courseId: c.id, locale, channelId: { in: channelIds }, status: 'sent' },
        select: { channelId: true },
      });
      const sentIds = new Set(alreadySentRows.map((r: { channelId: string }) => r.channelId));
      const pendingChannels = activeChannels.filter((ch) => !sentIds.has(ch.id));
      if (pendingChannels.length === 0) continue;

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

      const res = await postCourseToTelegramChannels(data, settings as unknown as Record<string, unknown>, pendingChannels);
      if (res.success) {
        posted++;
        for (const channelId of res.channelIds) {
          await (db as any).telegramPost.upsert({
            where: { courseId_locale_channelId: { courseId: c.id, locale, channelId } },
            update: { status: 'sent', error: null, sentAt: new Date() },
            create: { courseId: c.id, locale, channelId, status: 'sent' },
          });
        }
        await logTelegramMessage({ courseId: c.id, courseTitle: tr.title, channels: res.channels, status: `sent:${locale}` });
      } else {
        failed.push(tr.title);
        for (const channel of pendingChannels) {
          await (db as any).telegramPost.upsert({
            where: { courseId_locale_channelId: { courseId: c.id, locale, channelId: channel.id } },
            update: { status: 'failed', error: 'sendMessage failed', sentAt: new Date() },
            create: { courseId: c.id, locale, channelId: channel.id, status: 'failed', error: 'sendMessage failed' },
          });
        }
      }
    }

    const remaining = await (db as any).courseTranslation.count({
      where: {
        locale,
        status: 'translated',
        course: { isPublished: true },
        NOT: {
          course: {
            telegramPosts: {
              every: { locale, channelId: { in: channelIds }, status: 'sent' },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      locale,
      posted,
      failed: failed.length,
      remaining,
      channels: activeChannels.map((c) => c.name || c.id),
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
