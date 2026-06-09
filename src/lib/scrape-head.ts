// ============================================
// Source head fingerprinting + early-stop logic
// ============================================
//
// Pure helpers (no DB, no network) used by /api/cron/scrape-batch to decide,
// based on a stable fingerprint of a source's first page, whether pages 2-5 can
// be safely skipped. Keeping these pure makes the early-stop decision testable
// in isolation — see scripts/scrape-head.test.mjs, which mirrors this logic.

/** Stable identity for non-URL fallbacks: lowercase, alphanumeric only. */
export function normalizeForFingerprint(text: string): string {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

/**
 * Normalize a course/coupon URL into a stable fingerprint key.
 * Drops query string, hash and trailing slash so the same course produces the
 * same fingerprint across runs even if tracking params or coupon codes change.
 */
export function normalizeFingerprintUrl(url: string): string {
  const raw = String(url || '').trim();
  try {
    const u = new URL(raw);
    const path = u.pathname.replace(/\/+$/, '');
    return `${u.host}${path}`.toLowerCase();
  } catch {
    return raw.toLowerCase().split('?')[0].split('#')[0].replace(/\/+$/, '');
  }
}

export interface HeadItem {
  /** Preferred stable identity: original course URL / coupon URL / canonical URL. */
  canonicalUrl?: string | null;
  couponUrl?: string | null;
  title: string;
}

/**
 * Compute a single stable fingerprint for a parsed listing item.
 * Prefers a canonical/coupon URL; falls back to normalized source + title.
 */
export function fingerprintItem(source: string, item: HeadItem): string {
  const url = (item.canonicalUrl || item.couponUrl || '').trim();
  if (url) return `${source}|${normalizeFingerprintUrl(url)}`;
  return `${source}|${normalizeForFingerprint(item.title)}`;
}

/** Compute the first `limit` (default 10) head fingerprints for a source. */
export function computeHeadFingerprints(source: string, items: HeadItem[], limit = 10): string[] {
  return items.slice(0, limit).map((i) => fingerprintItem(source, i));
}

/**
 * Decide whether the current head matches the previously stored head.
 * Returns true only when we are confident page 1 is unchanged:
 *   - the first 5 fingerprints match exactly (same order), OR
 *   - at least 8 of the first 10 fingerprints overlap.
 * A missing/empty previous checkpoint always returns false (uncertain).
 */
export function headMatchesPrevious(
  previous: string[] | null | undefined,
  current: string[],
): boolean {
  if (!previous || previous.length === 0) return false;
  if (!current || current.length === 0) return false;

  // Exact, ordered match of the first 5 fingerprints.
  if (previous.length >= 5 && current.length >= 5) {
    let exact = true;
    for (let i = 0; i < 5; i++) {
      if (previous[i] !== current[i]) {
        exact = false;
        break;
      }
    }
    if (exact) return true;
  }

  // Overlap of >= 8 of the first 10 fingerprints (order-independent).
  const prevSet = new Set(previous.slice(0, 10));
  let overlap = 0;
  for (const fp of current.slice(0, 10)) {
    if (prevSet.has(fp)) overlap++;
  }
  return overlap >= 8;
}

export interface StopDecisionInput {
  page: number;
  success: boolean;
  parsedCount: number;
  errCount: number;
  newCount: number;
  updatedCount: number;
  reactivatedCount: number;
  headMatchesPrevious: boolean;
}

export interface StopDecision {
  shouldStopSource: boolean;
  reason: string;
}

/**
 * Reliable early-stop decision. shouldStopSource is true ONLY when every
 * uncertainty is ruled out AND the head fingerprint confirms page 1 is
 * unchanged. Any doubt (page>1, parse failure, errors, head changed/missing,
 * or any new/updated/reactivated item) keeps scraping.
 */
export function decideShouldStopSource(input: StopDecisionInput): StopDecision {
  if (input.page !== 1) {
    return { shouldStopSource: false, reason: 'not page 1' };
  }
  if (!input.success) {
    return { shouldStopSource: false, reason: 'source scrape did not succeed' };
  }
  if (input.parsedCount <= 0) {
    return { shouldStopSource: false, reason: 'no items parsed' };
  }
  if (input.errCount > 0) {
    return { shouldStopSource: false, reason: 'errors during scrape' };
  }
  if (!input.headMatchesPrevious) {
    return { shouldStopSource: false, reason: 'head fingerprint missing or changed' };
  }
  if (input.newCount > 0 || input.updatedCount > 0 || input.reactivatedCount > 0) {
    return { shouldStopSource: false, reason: 'new/updated/reactivated items found' };
  }
  return {
    shouldStopSource: true,
    reason: 'source head unchanged and no new/updated items',
  };
}
