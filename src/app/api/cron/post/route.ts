import { NextResponse } from 'next/server';

// GET /api/cron/post?secret=CRON_SECRET
// Post-only drainer (no scraping). Posts a batch of still-unposted courses to
// the active Telegram channels, then returns how many remain. Hitting this
// often (e.g. every 10-15 min from the Oracle VM) drains a backlog quickly and
// keeps up afterwards, without the scrape eating the serverless time budget.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret') || '';
    const expected = process.env.CRON_SECRET || process.env.ADMIN_PASSWORD || '';
    if (expected && secret !== expected) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '15'), 1), 18);

    const {
      getTelegramSettings,
      getUnpostedCourses,
      markCourseTelegramPosted,
      logTelegramMessage,
      countCourses,
    } = await import('@/lib/queries');
    const { postCourseToTelegram } = await import('@/lib/telegram');

    const settings = await getTelegramSettings();
    const token = process.env.TELEGRAM_BOT_TOKEN || settings.bot_token;
    const activeChannels = (settings.channels || []).filter((c) => c.active && c.id);

    if (!token) return NextResponse.json({ success: true, posted: 0, error: 'TELEGRAM_BOT_TOKEN not set' });
    if (activeChannels.length === 0) return NextResponse.json({ success: true, posted: 0, error: 'no active channels' });

    const unposted = await getUnpostedCourses(limit);
    if (unposted.length === 0) {
      return NextResponse.json({ success: true, posted: 0, remaining: 0, message: 'all caught up' });
    }

    // Keep the whole batch inside the serverless time budget.
    const delayMs = Math.min(Math.max(settings.post_delay_ms || 3000, 2000), 4000);

    let posted = 0;
    const failed: string[] = [];
    for (let i = 0; i < unposted.length; i++) {
      const c = unposted[i];
      const data = {
        title: c.title, instructor: c.instructor, category: c.category, rating: c.rating,
        students_count: c.studentsCount, original_price: c.originalPrice, language: c.language,
        duration: c.duration, udemy_url: c.couponUrl || c.udemyUrl || '', slug: c.slug,
      };
      const res = await postCourseToTelegram(data, settings as unknown as Record<string, unknown>);
      if (res.success) {
        await markCourseTelegramPosted(c.id);
        posted++;
        await logTelegramMessage({ courseId: c.id, courseTitle: c.title, channels: res.channels, status: 'sent' });
      } else {
        failed.push(c.title);
      }
      if (i < unposted.length - 1) await new Promise((r) => setTimeout(r, delayMs));
    }

    const remaining = await countCourses({ isPublished: true, telegramPosted: false });
    return NextResponse.json({
      success: true,
      posted,
      failed: failed.length,
      remaining,
      delayMs,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
