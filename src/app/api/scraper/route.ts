import { NextResponse } from 'next/server';
import { runFullScrape, cleanupDuplicates } from '@/lib/scraper';
import { verifyAdminPassword, getRecentScraperLogs } from '@/lib/mongodb';

// POST /api/scraper - Trigger scraper or cleanup (protected by admin password)
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { password, pages, action } = body;

    // Verify admin password
    const isValid = await verifyAdminPassword(password);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid admin password' },
        { status: 401 }
      );
    }

    // Cleanup duplicates action
    if (action === 'cleanup') {
      const result = await cleanupDuplicates();
      return NextResponse.json({
        success: true,
        message: `Removed ${result.removed} duplicate courses`,
        removed: result.removed,
      });
    }

    // Run scraper with optional page count (default 20 pages)
    const maxPages = Math.min(Math.max(parseInt(String(pages)) || 20, 1), 223);
    const results = await runFullScrape({
      pages: maxPages,
    });

    return NextResponse.json({
      success: true,
      message: results.totalNew > 0
        ? `Added ${results.totalNew} new courses from ${maxPages} pages in ${Math.round(results.totalDuration / 1000)}s`
        : 'No new courses found (all duplicates or expired coupons)',
      totalNew: results.totalNew,
      totalDup: results.totalDup,
      totalErr: results.totalErr,
      totalDuration: results.totalDuration,
      details: {
        udemyfreebies: {
          ...results.udemyfreebies,
          courses: undefined, // Don't return full course data in response
        },
      },
    });
  } catch (e) {
    console.error('Scraper error:', e);
    return NextResponse.json(
      { success: false, error: `Scraper failed: ${String(e)}` },
      { status: 500 }
    );
  }
}

// GET /api/scraper - Get recent scraper logs (no auth required for public stats)
export async function GET() {
  try {
    const logs = await getRecentScraperLogs(20);
    return NextResponse.json({
      success: true,
      logs: logs.map(l => ({
        id: l.id,
        source: l.source,
        status: l.status,
        newCount: l.newCount,
        dupCount: l.dupCount,
        errCount: l.errCount,
        message: l.message,
        duration: l.duration,
        timestamp: l.timestamp,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
