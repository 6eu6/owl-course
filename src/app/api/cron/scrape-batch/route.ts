import { NextResponse } from 'next/server';
import { scrapeSourcePage, type ScrapeSource } from '@/lib/scraper';
import { getSetting, setSetting } from '@/lib/queries';
import {
  computeHeadFingerprints,
  headMatchesPrevious as computeHeadMatch,
  decideShouldStopSource,
} from '@/lib/scrape-head';

// Bounded, single source + single page scrape. Oracle drives this endpoint in a
// loop and uses `shouldStopSource` to skip pages 2-5 when a source's first page
// is provably unchanged. Each request does exactly one source/page so it can
// never approach Vercel's function timeout.

const ALLOWED_SOURCES: ScrapeSource[] = ['udemyfreebies', 'studybullet'];
const MIN_PAGE = 1;
const MAX_PAGE = 5;

/** Setting key holding the JSON array of a source's first-10 head fingerprints. */
function headCheckpointKey(source: ScrapeSource): string {
  return `scrape_head_${source}`;
}

async function loadPreviousHead(source: ScrapeSource): Promise<string[] | null> {
  try {
    const raw = await getSetting(headCheckpointKey(source));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
      return parsed as string[];
    }
    return null;
  } catch {
    return null;
  }
}

async function saveHead(source: ScrapeSource, fingerprints: string[]): Promise<void> {
  try {
    await setSetting(headCheckpointKey(source), JSON.stringify(fingerprints.slice(0, 10)));
  } catch (err) {
    console.error(`[Cron/ScrapeBatch] Failed to persist head checkpoint for ${source}:`, err);
  }
}

// GET /api/cron/scrape-batch?secret=SECRET&source=udemyfreebies&page=1
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // --- Auth: same secret as /api/cron/scrape ---
    const cronSecret = searchParams.get('secret') || '';
    const expectedSecret = process.env.CRON_SECRET || process.env.ADMIN_PASSWORD || '';
    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: invalid or missing cron secret' },
        { status: 401 },
      );
    }

    // --- Validate source ---
    const sourceParam = (searchParams.get('source') || '').trim().toLowerCase();
    if (!ALLOWED_SOURCES.includes(sourceParam as ScrapeSource)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid source. Allowed: ${ALLOWED_SOURCES.join(', ')}`,
        },
        { status: 400 },
      );
    }
    const source = sourceParam as ScrapeSource;

    // --- Validate page (integer 1..5) ---
    const pageRaw = searchParams.get('page') || '';
    const page = Number(pageRaw);
    if (!Number.isInteger(page) || page < MIN_PAGE || page > MAX_PAGE) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid page. Must be an integer ${MIN_PAGE}..${MAX_PAGE}`,
        },
        { status: 400 },
      );
    }

    console.log(`[Cron/ScrapeBatch] Scraping source=${source} page=${page} at ${new Date().toISOString()}`);

    // --- Scrape exactly one source/page ---
    const result = await scrapeSourcePage(source, page, {
      skipVerification: true,
      skipCleanup: true,
    });

    const headFingerprints = computeHeadFingerprints(source, result.items);

    // --- Head fingerprint checkpoint (page 1 only) ---
    let headMatchesPrevious: boolean | null = null;
    if (page === 1) {
      const previous = await loadPreviousHead(source);
      headMatchesPrevious = computeHeadMatch(previous, headFingerprints);

      // Only update the checkpoint after a clean, productive parse so a failed
      // or empty page can never overwrite a good head signature.
      if (result.success && result.parsedCount > 0 && result.stats.errCount === 0) {
        await saveHead(source, headFingerprints);
      }
    }

    // --- Early-stop decision ---
    const decision = decideShouldStopSource({
      page,
      success: result.success,
      parsedCount: result.parsedCount,
      errCount: result.stats.errCount,
      newCount: result.stats.newCount,
      updatedCount: result.stats.updatedCount,
      reactivatedCount: result.stats.reactivatedCount,
      headMatchesPrevious: headMatchesPrevious === true,
    });

    return NextResponse.json({
      success: result.success,
      source,
      page,
      parsedCount: result.parsedCount,
      headFingerprints,
      headMatchesPrevious,
      stats: {
        newCount: result.stats.newCount,
        dupCount: result.stats.dupCount,
        updatedCount: result.stats.updatedCount,
        reactivatedCount: result.stats.reactivatedCount,
        expiredCount: result.stats.expiredCount,
        errCount: result.stats.errCount,
        durationMs: result.stats.durationMs,
      },
      shouldStopSource: decision.shouldStopSource,
      reason: decision.reason,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[Cron/ScrapeBatch] Error:', e);
    return NextResponse.json(
      { success: false, error: `Scrape batch failed: ${String(e)}` },
      { status: 500 },
    );
  }
}
