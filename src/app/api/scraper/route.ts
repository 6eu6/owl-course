import { NextResponse } from 'next/server';
import { runFullScrape } from '@/lib/scraper';
import { verifyAdminPassword, getRecentScraperLogs } from '@/lib/mongodb';

// POST /api/scraper - Trigger scraper (protected by admin password)
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { password, source } = body;

    // Verify admin password
    const isValid = await verifyAdminPassword(password);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid admin password' },
        { status: 401 }
      );
    }

    // Run scraper with optional source filter
    const sources: string[] | undefined = source && source !== 'all' ? [source] : undefined;
    const results = await runFullScrape(sources);

    return NextResponse.json({
      success: true,
      message: results.totalNew > 0
        ? `Added ${results.totalNew} new courses`
        : 'No new courses found',
      totalNew: results.totalNew,
      totalDup: results.totalDup,
      totalErr: results.totalErr,
      totalDuration: results.totalDuration,
      details: {
        udemyfreebies: results.udemyfreebies,
        studybullet: results.studybullet,
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
