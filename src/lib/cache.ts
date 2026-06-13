// ============================================
// Read-side caching for public course listings
// ============================================
//
// Public pages fetch course data on every request. Without caching, database
// operations scale linearly with visitor count — 1,000 visitors ≈ thousands of
// operations. Wrapping the read queries in Next's Data Cache decouples them:
// the database is touched at most once per revalidation window, regardless of
// how many visitors are served.
//
// Two layers keep listings fresh:
//   1. Time-based: every cached read carries `revalidate: COURSES_REVALIDATE`,
//      so a stale entry is recomputed at most once per window no matter the
//      traffic. This is the load-bearing guarantee — freshness never depends on
//      anything firing correctly.
//   2. On-demand: after a scrape stores new courses, or a translation batch
//      publishes Arabic rows, the cron route calls revalidateCourses() to purge
//      the tag immediately so new pulls surface within seconds rather than
//      waiting out the window.

import { revalidateTag } from 'next/cache';

/** Shared cache tag for every course/category/stats listing read. */
export const COURSES_TAG = 'courses';

/**
 * Time-based revalidation window (seconds). Kept short enough that a new pull is
 * always visible quickly even if an on-demand purge is ever skipped, and long
 * enough that, under any traffic, course reads cost at most a handful of
 * database operations per minute instead of one set per visitor.
 */
export const COURSES_REVALIDATE = 120;

/**
 * Best-effort immediate purge of every cached course listing. Safe to call from
 * Route Handlers (e.g. the scrape/translate crons) after a write that changes
 * what the public site shows. `{ expire: 0 }` requests immediate expiry under
 * Next 16's revalidateTag signature. Correctness never relies on this firing —
 * the time-based window above always refreshes regardless — so any failure is
 * swallowed to avoid turning a cache hint into a cron error.
 */
export function revalidateCourses(): void {
  try {
    revalidateTag(COURSES_TAG, { expire: 0 });
  } catch (err) {
    console.error('[cache] revalidateCourses failed (cache will refresh on its timer):', err);
  }
}
