import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// =============================================================================
// TEMPORARY i18n reset endpoint — Learn Plus Courses
// -----------------------------------------------------------------------------
// Deletes ONLY CourseTranslation and TelegramPost rows (experimental data).
// Does NOT touch Course, Setting, ScraperLog, TelegramMessage, or any other
// tables.
//
// Protected by CRON_SECRET AND a confirmation token.
//
// GET /api/cron/i18n-reset?secret=CRON_SECRET&confirm=RESET_I18N
//
// TODO(i18n): remove this route once i18n is stable in production.
// =============================================================================

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret') || '';
  const confirm = searchParams.get('confirm') || '';
  const expected = process.env.CRON_SECRET || process.env.ADMIN_PASSWORD || '';

  if (expected && secret !== expected) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (confirm !== 'RESET_I18N') {
    return NextResponse.json(
      {
        success: false,
        error: 'Missing or incorrect confirm parameter. Use confirm=RESET_I18N to proceed.',
      },
      { status: 400 }
    );
  }

  try {
    const deletedPosts = await (db as any).telegramPost.deleteMany({});
    const deletedTranslations = await (db as any).courseTranslation.deleteMany({});

    return NextResponse.json({
      success: true,
      deleted: {
        telegramPosts: deletedPosts.count,
        courseTranslations: deletedTranslations.count,
      },
      message: 'i18n data reset complete — Course, Setting, ScraperLog, TelegramMessage tables untouched.',
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
