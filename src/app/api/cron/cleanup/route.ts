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

  // Delete only past the grace window, AND when the course is genuinely finished:
  //   - its coupon has expired, OR
  //   - it is a (limited-time) coupon course older than STALE_DAYS.
  // "Free forever" courses are NOT limited-time offers, so they are never removed
  // by the stale branch (and they carry no couponExpiresAt, so the expired branch
  // never matches them either) — this prevents dropping permanent free courses.
  //
  // Note: since a re-scrape now skips already-stored courses (to save DB ops),
  // scrapedAt is the course's first-seen time and is not refreshed. The stale
  // branch therefore enforces a clean "remove coupon courses ~a week after they
  // were added" policy, which matches how temporary coupons behave.
  const where: Prisma.CourseWhereInput = {
    scrapedAt: { lt: graceCutoff },
    OR: [
      { couponExpiresAt: { lt: now } },
      { isFreeForever: false, scrapedAt: { lt: staleCutoff } },
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
