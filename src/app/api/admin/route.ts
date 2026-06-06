import { NextResponse } from 'next/server';
import { setSetting, getAllSettings, verifyAdminPassword, getRecentScraperLogs } from '@/lib/mongodb';
import { runFullScrape } from '@/lib/scraper';

// GET /api/admin - Get all settings
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // GET scraper logs
    if (action === 'logs') {
      const password = searchParams.get('password');
      const isValid = await verifyAdminPassword(password || '');
      if (!isValid) {
        return NextResponse.json({ success: false, error: 'Invalid admin password' }, { status: 401 });
      }

      const limit = parseInt(searchParams.get('limit') || '20');
      const logs = await getRecentScraperLogs(limit);
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
    }

    // GET all settings (public ones only, or all with password)
    const settings = await getAllSettings();
    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (e) {
    console.error('Admin GET error:', e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}

// POST /api/admin - Update settings or trigger scrape (protected by admin password)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { password, action } = body;

    // Action: verify password only (used by admin login)
    if (action === 'verify') {
      const isValid = await verifyAdminPassword(password);
      if (!isValid) {
        return NextResponse.json(
          { success: false, error: 'Invalid admin password' },
          { status: 401 }
        );
      }
      return NextResponse.json({ success: true, message: 'Password verified' });
    }

    // Verify admin password for all other POST operations
    const isValid = await verifyAdminPassword(password);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid admin password' },
        { status: 401 }
      );
    }

    // Action: update setting
    if (action === 'set') {
      const { key, value } = body;
      if (!key) {
        return NextResponse.json(
          { success: false, error: 'Key is required' },
          { status: 400 }
        );
      }

      await setSetting(key, value);
      return NextResponse.json({ success: true, message: `Setting "${key}" updated` });
    }

    // Action: update multiple settings
    if (action === 'set_many') {
      const { settings } = body;
      if (!settings || !Array.isArray(settings)) {
        return NextResponse.json(
          { success: false, error: 'Settings array is required' },
          { status: 400 }
        );
      }

      await Promise.all(
        settings.map((s: { key: string; value: string }) => setSetting(s.key, s.value))
      );
      return NextResponse.json({ success: true, message: `${settings.length} settings updated` });
    }

    // Action: trigger scrape
    if (action === 'scrape') {
      const { source } = body;
      const sources: string[] | undefined = source && source !== 'all' ? [source] : undefined;
      const results = await runFullScrape({ sources });

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
          discudemy: results.discudemy,
          freebiesglobal: results.freebiesglobal,
        },
      });
    }

    // Default: single setting update (backward compatible)
    if (body.key && body.value !== undefined) {
      await setSetting(body.key, body.value);
      return NextResponse.json({ success: true, message: `Setting "${body.key}" updated` });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action. Use action: "set" | "set_many" | "scrape"' },
      { status: 400 }
    );
  } catch (e) {
    console.error('Admin POST error:', e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
