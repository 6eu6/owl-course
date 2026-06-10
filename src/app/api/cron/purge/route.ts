import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// =============================================================================
// Experimental purge endpoint — Learn Plus Courses
// -----------------------------------------------------------------------------
// Wipes course data for a clean rebuild (scrape -> translate en/ar -> publish).
// Deletes ALL Course rows; CourseTranslation and TelegramPost cascade-delete via
// their ON DELETE CASCADE foreign keys. TelegramMessage (a log with a loose,
// FK-less courseId) is cleared separately and guarded.
//
// Does NOT scrape, does NOT post, does NOT touch Setting.
//
// Double-gated: requires the cron secret AND confirm=PURGE_ALL.
//
// GET /api/cron/purge?secret=CRON_SECRET&confirm=PURGE_ALL
// =============================================================================
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret') || '';
  const confirm = searchParams.get('confirm') || '';
  const expected = process.env.CRON_SECRET || process.env.ADMIN_PASSWORD || '';

  if (expected && secret !== expected) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (confirm !== 'PURGE_ALL') {
    return NextResponse.json(
      { success: false, error: 'Refusing to purge: pass confirm=PURGE_ALL' },
      { status: 400 }
    );
  }

  try {
    // Cascades remove CourseTranslation + TelegramPost rows automatically.
    const courses = await db.course.deleteMany({});

    // TelegramMessage has no FK to Course, so clear it directly. Guarded in case
    // the table does not exist yet.
    let deletedTelegramMessages = 0;
    try {
      const msgs = await (db as any).telegramMessage.deleteMany({});
      deletedTelegramMessages = msgs.count;
    } catch {
      /* table missing — ignore safely */
    }

    return NextResponse.json({
      success: true,
      deletedCourses: courses.count,
      deletedTelegramMessages,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
