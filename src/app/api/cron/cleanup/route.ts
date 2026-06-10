import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

// =============================================================================
// Expired-course cleanup endpoint — Learn Plus Courses
// -----------------------------------------------------------------------------
// Coupon courses are temporary. This endpoint deletes courses whose coupon has
// expired OR that have gone stale, so they disappear from the DB, from /en and
// /ar, and from all records. CourseTranslation (en + ar) and TelegramPost rows
// are removed automatically by the ON DELETE CASCADE foreign keys.
//
// PRECISE / SAFE by design:
//   - Recently scraped courses are NEVER deleted (GRACE_DAYS), so a freshly
//     added course can never be removed even if its coupon date is mis-parsed.
//   - Delete only when (coupon expired) OR (stale: scrapedAt older than
//     STALE_DAYS), AND the course is past the grace window.
//
// This is a delete-only maintenance job. It does NOT scrape and does NOT post.
//
// GET /api/cron/cleanup?secret=CRON_SECRET            -> deletes, returns count
// GET /api/cron/cleanup?secret=CRON_SECRET&dryRun=1   -> preview, deletes nothing
// =============================================================================

const DAY_MS = 24 * 60 * 60 * 1000;
// Never touch a course scraped within this window — protects new arrivals.
const GRACE_DAYS = 2;
// A course not seen in a scrape for this long is considered gone/stale.
const STALE_DAYS = 7;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret') || '';
  const expected = process.env.CRON_SECRET || process.env.ADMIN_PASSWORD || '';

  if (expected && secret !== expected) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const dryRun = ['1', 'true', 'yes'].includes((searchParams.get('dryRun') || '').toLowerCase());

  const now = new Date();
  const graceCutoff = new Date(now.getTime() - GRACE_DAYS * DAY_MS);
  const staleCutoff = new Date(now.getTime() - STALE_DAYS * DAY_MS);

  // Past the grace window AND (coupon expired OR stale).
  // staleCutoff is older than graceCutoff, so the stale branch already implies
  // the grace condition; the top-level scrapedAt guard makes the coupon branch
  // safe for recently re-scraped courses.
  const where: Prisma.CourseWhereInput = {
    scrapedAt: { lt: graceCutoff },
    OR: [
      { couponExpiresAt: { lt: now } },
      { scrapedAt: { lt: staleCutoff } },
    ],
  };

  try {
    if (dryRun) {
      const [wouldDelete, sample] = await Promise.all([
        db.course.count({ where }),
        db.course.findMany({
          where,
          select: { id: true, title: true, slug: true, couponExpiresAt: true, scrapedAt: true },
          orderBy: { scrapedAt: 'asc' },
          take: 20,
        }),
      ]);
      return NextResponse.json({
        success: true,
        dryRun: true,
        graceDays: GRACE_DAYS,
        staleDays: STALE_DAYS,
        wouldDelete,
        sample,
        timestamp: now.toISOString(),
      });
    }

    const result = await db.course.deleteMany({ where });

    return NextResponse.json({
      success: true,
      deleted: result.count,
      graceDays: GRACE_DAYS,
      staleDays: STALE_DAYS,
      timestamp: now.toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
