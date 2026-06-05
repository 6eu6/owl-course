import { NextResponse } from 'next/server';
import { runFullScrape } from '@/lib/scraper';
import { autoPostToTelegram } from '@/lib/telegram';

// GET /api/cron/scrape - Vercel Cron endpoint (runs every 4 hours)
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

    // Run scraper with default settings: 5 pages, all sources
    const results = await runFullScrape({ pages: 5 });

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
      },
    };

    // Auto-post new courses to Telegram if enabled
    let telegramStats: { posted: number; errors: string[] } | null = null;
    if (results.totalNew > 0) {
      try {
        telegramStats = await autoPostToTelegram(10);
        console.log(`[Cron/Scrape] Telegram auto-post: ${telegramStats.posted} posted`);
      } catch (tgErr) {
        console.error('[Cron/Scrape] Telegram auto-post failed:', tgErr);
        telegramStats = { posted: 0, errors: [String(tgErr)] };
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cron scrape complete: ${results.totalNew} new courses in ${scrapeStats.totalDuration}s`,
      scraped: scrapeStats,
      telegram: telegramStats
        ? { posted: telegramStats.posted, errors: telegramStats.errors }
        : null,
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
