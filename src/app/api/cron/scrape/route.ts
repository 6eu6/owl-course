import { NextResponse } from 'next/server';
import { runFullScrape } from '@/lib/scraper';
import { autoPostToTelegram } from '@/lib/telegram';
import { getTelegramSettings, getUnpostedCourses } from '@/lib/queries';

// GET /api/cron/scrape - scheduled scrape endpoint triggered by Oracle VM or cron
// Protected by CRON_SECRET or ADMIN_PASSWORD env variable
export async function GET(request: Request) {
  try {
    // Verify cron secret for security
    const { searchParams } = new URL(request.url);
    const cronSecret = searchParams.get('secret') || '';
    const expectedSecret = process.env.CRON_SECRET || process.env.ADMIN_PASSWORD || '';

    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: invalid or missing cron secret' },
        { status: 401 }
      );
    }

    console.log(`[Cron/Scrape] Starting scheduled scrape at ${new Date().toISOString()}`);

    // Run scraper with verification skipped to fit within Vercel 60s function timeout.
    // Verification and cleanup are too slow for serverless — they need a long-running process.
    const results = await runFullScrape({ pages: 5, skipVerification: true, skipCleanup: true });

    const scrapeStats = {
      totalNew: results.totalNew,
      totalDup: results.totalDup,
      totalErr: results.totalErr,
      totalDuration: Math.round(results.totalDuration / 1000),
      sources: {
        udemyfreebies: {
          status: results.udemyfreebies.status,
          newCount: results.udemyfreebies.newCount,
          dupCount: results.udemyfreebies.dupCount,
          errCount: results.udemyfreebies.errCount,
          duration: Math.round(results.udemyfreebies.duration / 1000),
        },
        studybullet: {
          status: results.studybullet.status,
          newCount: results.studybullet.newCount,
          dupCount: results.studybullet.dupCount,
          errCount: results.studybullet.errCount,
          duration: Math.round(results.studybullet.duration / 1000),
        },
      },
    };

    // Auto-post any published courses that are still not posted.
    // This is not limited to results.totalNew, so Oracle VM can recover pending courses
    // from previous scrape runs. The delay between messages is read from post_delay_ms.
    let telegramStats: { posted: number; errors: string[]; skipped?: string; pending?: number } | null = null;
    try {
      const settings = await getTelegramSettings();
      const token = process.env.TELEGRAM_BOT_TOKEN || settings.bot_token;
      const activeChannels = (settings.channels || []).filter((c) => c.active && c.id);
      const pendingCourses = await getUnpostedCourses(10);

      if (!settings.auto_post) {
        telegramStats = { posted: 0, errors: [], skipped: 'auto-post disabled', pending: pendingCourses.length };
      } else if (!token) {
        telegramStats = { posted: 0, errors: ['TELEGRAM_BOT_TOKEN is not set'], pending: pendingCourses.length };
      } else if (activeChannels.length === 0) {
        telegramStats = { posted: 0, errors: ['no active Telegram channels'], pending: pendingCourses.length };
      } else if (pendingCourses.length === 0) {
        telegramStats = { posted: 0, errors: [], skipped: 'no unposted courses', pending: 0 };
      } else {
        telegramStats = await autoPostToTelegram(10);
        telegramStats.pending = pendingCourses.length;
        console.log(`[Cron/Scrape] Telegram auto-post: ${telegramStats.posted} posted`);
      }
    } catch (tgErr) {
      console.error('[Cron/Scrape] Telegram auto-post failed:', tgErr);
      telegramStats = { posted: 0, errors: [String(tgErr)] };
    }

    return NextResponse.json({
      success: true,
      message: `Cron scrape complete: ${results.totalNew} new courses in ${scrapeStats.totalDuration}s`,
      scraped: scrapeStats,
      telegram: telegramStats,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[Cron/Scrape] Error:', e);
    return NextResponse.json(
      { success: false, error: `Cron scrape failed: ${String(e)}` },
      { status: 500 }
    );
  }
}
