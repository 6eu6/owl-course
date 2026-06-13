import { NextResponse } from 'next/server';
import { scrapeSourcePage, type ScrapeSource } from '@/lib/scraper';
import { revalidateCourses } from '@/lib/cache';

// This endpoint used to run a 5-page, multi-source scrape in a single request,
// which risked Vercel's 60s function timeout. Scraping is now batched per
// source/page via /api/cron/scrape-batch, driven by Oracle.
//
// To stay backward compatible and never time out, this route now scrapes only
// page 1 of each source (bounded work) and tells callers to use scrape-batch
// for full, head-aware paging.

const SOURCES: ScrapeSource[] = ['udemyfreebies', 'studybullet'];

// GET /api/cron/scrape - safe, bounded page-1 scrape. Protected by CRON_SECRET
// or ADMIN_PASSWORD. For full 5-page paging use /api/cron/scrape-batch.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cronSecret = searchParams.get('secret') || '';
    const expectedSecret = process.env.CRON_SECRET || process.env.ADMIN_PASSWORD || '';

    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: invalid or missing cron secret' },
        { status: 401 },
      );
    }

    const startedAt = Date.now();
    console.log(`[Cron/Scrape] Starting bounded page-1 scrape at ${new Date().toISOString()}`);

    // Page 1 only, one source at a time. New courses almost always show up on
    // page 1, so this remains useful while being far under the timeout.
    const sources: Record<string, unknown> = {};
    let totalNew = 0;
    let totalErr = 0;

    for (const source of SOURCES) {
      const result = await scrapeSourcePage(source, 1, {
        skipVerification: true,
        skipCleanup: true,
      });
      totalNew += result.stats.newCount;
      totalErr += result.stats.errCount;
      sources[source] = {
        success: result.success,
        parsedCount: result.parsedCount,
        ...result.stats,
      };
    }

    // New courses were stored → refresh the public listing cache immediately.
    if (totalNew > 0) {
      revalidateCourses();
    }

    const totalDuration = Date.now() - startedAt;

    return NextResponse.json({
      success: true,
      message: `Bounded page-1 scrape complete: ${totalNew} new in ${Math.round(totalDuration / 1000)}s`,
      note: 'This endpoint only scrapes page 1 to avoid timeouts. Use /api/cron/scrape-batch?source=SRC&page=N for full head-aware 5-page paging.',
      scraped: {
        totalNew,
        totalErr,
        totalDuration: Math.round(totalDuration / 1000),
        pages: 1,
        sources,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[Cron/Scrape] Error:', e);
    return NextResponse.json(
      { success: false, error: `Cron scrape failed: ${String(e)}` },
      { status: 500 },
    );
  }
}
