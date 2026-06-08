import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateArabicPayload } from '@/lib/course-translations';

// =============================================================================
// Arabic quality audit endpoint — Learn Plus Courses
// -----------------------------------------------------------------------------
// Scans CourseTranslation rows for locale='ar' and status='translated'.
// Validates using the same Arabic quality gate as the translation pipeline.
// If fix=1, updates bad rows to status='failed' so the translate cron retries.
//
// Does NOT touch English translations, Course, Setting, or other tables.
// Does NOT delete any rows.
//
// GET /api/cron/i18n-audit?secret=CRON_SECRET&locale=ar&fix=1
// =============================================================================

type TranslationRow = {
  id: string;
  courseId: string;
  locale: string;
  title: string;
  description: string;
  requirements: string;
  whoFor: string;
  whatLearn: string;
  category: string;
  metaTitle: string;
  metaDescription: string;
  status: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret') || '';
  const locale = searchParams.get('locale') || 'ar';
  const fix = searchParams.get('fix') === '1';
  const expected = process.env.CRON_SECRET || process.env.ADMIN_PASSWORD || '';

  if (expected && secret !== expected) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (locale !== 'ar') {
    return NextResponse.json({ success: false, error: 'Audit only supports locale=ar' }, { status: 400 });
  }

  try {
    // Fetch all Arabic translated rows for auditing.
    const rows = await (db as any).courseTranslation.findMany({
      where: { locale: 'ar', status: 'translated' },
    });

    let checked = 0;
    let bad = 0;
    let fixed = 0;
    const badRows: Array<{ courseId: string; title: string; errors: string[] }> = [];

    for (const row of rows as TranslationRow[]) {
      checked++;

      const payload = {
        title: row.title,
        description: row.description,
        requirements: row.requirements,
        whoFor: row.whoFor,
        whatLearn: row.whatLearn,
        category: row.category,
        metaTitle: row.metaTitle,
        metaDescription: row.metaDescription,
      };

      const errors = validateArabicPayload(payload);

      if (errors.length > 0) {
        bad++;
        badRows.push({ courseId: row.courseId, title: row.title.slice(0, 80), errors });

        if (fix) {
          await (db as any).courseTranslation.update({
            where: { id: row.id },
            data: {
              status: 'failed',
              error: `Arabic quality audit failed: ${errors.join(', ')}`,
            },
          });
          fixed++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      locale,
      checked,
      bad,
      fixed,
      fixApplied: fix,
      badRows,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
