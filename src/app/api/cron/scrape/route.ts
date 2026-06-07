import { NextResponse } from 'next/server';
import { runFullScrape, type ScrapeResult } from '@/lib/scraper';

const PAGES = 5;
// Keep a safety margin under Vercel's 60s function limit. This endpoint is now
// scrape-only; Telegram posting is handled by /api/cron/post.
const TIME_BUDGET_MS = 52_000;
const MIN_TIME_FOR_NEXT_SOURCE_MS = 12_000;

type SourceKey = 'udemyfreebies' | 'studybullet';

function elapsedMs(startedAt: number): number {
  return Date.now() - startedAt;
}

function hasEnoughTimeForNextSource(startedAt: number): boolean {
  return TIME_BUDGET_MS - elapsedMs(startedAt) >= MIN_TIME_FOR_NEXT_SOURCE_MS;
}

function emptySource(source: SourceKey): ScrapeResult[SourceKey] {
  return {
    source,
    status: 'partial',
    newCount: 0,
    dupCount: 0,
    errCount: 0,
    expiredCount: 0,
    updatedCount: 0,
    message: 'Skipped by scrape cron time budget before this source started',
    duration: 0,
    courses: [],
  };
}

function sourceStats(source: ScrapeResult[SourceKey]) {
  return {
    status: source.status,
    newCount: source.newCount,
    dupCount: source.dupCount,
    errCount: source.errCount,
    updatedCount: source.updatedCount,
    expiredCount: source.expiredCount,
    duration: Math.round(source.duration / 1000),
    message: source.message,
  };
}

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

    const startedAt = Date.now();
    console.log(`[Cron/Scrape] Starting scheduled scrape at ${new Date().toISOString()}`);

    // Scrape-only path. Do NOT post to Telegram here: /api/cron/post drains
    // Telegram separately, so a slow Telegram batch cannot kill the scraper.
    // Pages stay at 5 for now; the route-level budget only prevents starting a
    // second source when the request is already close to Vercel's 60s limit.
    const udemyRun = await runFullScrape({
      pages: PAGES,
      sources: ['udemyfreebies'],
      skipVerification: true,
      skipCleanup: true,
    });

    let studybullet = emptySource('studybullet');
    let timeBudgetHit = false;

    if (hasEnoughTimeForNextSource(startedAt)) {
      const studyRun = await runFullScrape({
        pages: PAGES,
        sources: ['studybullet'],
        skipVerification: true,
        skipCleanup: true,
      });
      studybullet = studyRun.studybullet;
    } else {
      timeBudgetHit = true;
      console.warn(`[Cron/Scrape] Time budget hit after udemyfreebies (${Math.round(elapsedMs(startedAt) / 1000)}s). Skipping studybullet this run.`);
    }

    const udemyfreebies = udemyRun.udemyfreebies;
    const totalDuration = elapsedMs(startedAt);
    const totalNew = udemyfreebies.newCount + studybullet.newCount;
    const totalDup = udemyfreebies.dupCount + studybullet.dupCount;
    const totalErr = udemyfreebies.errCount + studybullet.errCount;

    const scrapeStats = {
      totalNew,
      totalDup,
      totalErr,
      totalDuration: Math.round(totalDuration / 1000),
      pages: PAGES,
      timeBudgetMs: TIME_BUDGET_MS,
      timeBudgetHit,
      telegramPosting: 'disabled_here_use_/api/cron/post',
      sources: {
        udemyfreebies: sourceStats(udemyfreebies),
        studybullet: sourceStats(studybullet),
      },
    };

    return NextResponse.json({
      success: true,
      message: `Cron scrape complete: ${totalNew} new courses in ${scrapeStats.totalDuration}s`,
      scraped: scrapeStats,
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
