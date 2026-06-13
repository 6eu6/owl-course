import { NextResponse } from 'next/server';
import { recategorizeUncategorized } from '@/lib/scraper';
import { revalidateCourses } from '@/lib/cache';

// =============================================================================
// Re-categorize 'Other' courses — Learn Plus Courses
// -----------------------------------------------------------------------------
// One-off / on-demand backfill. The categorizer now also reads the course link's
// slug, so courses stored as 'Other' before that (their title alone gave no
// signal) can be moved under their real category. Only rows whose category
// actually changes are written, so this is bounded and cheap to re-run.
//
// GET /api/cron/recategorize?secret=CRON_SECRET
// =============================================================================
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret') || '';
    const expected = process.env.CRON_SECRET || process.env.ADMIN_PASSWORD || '';
    if (expected && secret !== expected) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const result = await recategorizeUncategorized();

    // Categories changed → refresh the cached listings/filters.
    if (result.updated > 0) {
      revalidateCourses();
    }

    return NextResponse.json({
      success: true,
      scanned: result.scanned,
      updated: result.updated,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[Cron/Recategorize] Error:', e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
