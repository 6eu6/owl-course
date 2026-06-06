import { NextResponse } from 'next/server';
import { runFullScrape, cleanupDuplicates } from '@/lib/scraper';
import { verifyAdminPassword, getRecentScraperLogs, cleanupInvalidCourses, purgeAllCourses } from '@/lib/mongodb';

// POST /api/scraper - Trigger scraper or cleanup (protected by admin password)
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { password, pages, action, sources } = body;

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

    // Cleanup invalid courses (no coupon, fake free forever)
    if (action === 'clean-invalid') {
      const result = await cleanupInvalidCourses();
      return NextResponse.json({
        success: true,
        message: `Cleaned ${result.totalRemoved} invalid courses (${result.removedNoCoupon} no coupon, ${result.removedFakeFree} fake free forever, ${result.removedDuplicates} duplicates)`,
        ...result,
      });
    }

    // Purge ALL courses (fresh start)
    if (action === 'purge') {
      const result = await purgeAllCourses();
      return NextResponse.json({
        success: true,
        message: `Purged ${result.removed} courses from database`,
        removed: result.removed,
      });
    }

    // Run scraper with optional page count and sources
    const maxPages = Math.min(Math.max(parseInt(String(pages)) || 20, 1), 223);
    const sourceList = Array.isArray(sources) ? sources : undefined;
    const results = await runFullScrape({
      pages: maxPages,
      sources: sourceList,
    });

    return NextResponse.json({
      success: true,
      message: results.totalNew > 0
        ? `Added ${results.totalNew} new courses in ${Math.round(results.totalDuration / 1000)}s`
        : 'No new courses found (all duplicates or expired coupons)',
      totalNew: results.totalNew,
      totalDup: results.totalDup,
      totalErr: results.totalErr,
      totalDuration: results.totalDuration,
      details: {
        udemyfreebies: {
          ...results.udemyfreebies,
          courses: undefined,
        },
        studybullet: {
          ...results.studybullet,
          courses: undefined,
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
