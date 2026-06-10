// Runnable checks for the scrape head-fingerprint + early-stop logic.
// Run: node --test scripts/
//
// These mirror the canonical logic in src/lib/scrape-head.ts. Keep them in sync
// with that file when the fingerprint or stop rules change.

import assert from 'node:assert/strict';
import test from 'node:test';

// --- mirrors of src/lib/scrape-head.ts -------------------------------------

function normalizeForFingerprint(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function normalizeFingerprintUrl(url) {
  const raw = String(url || '').trim();
  try {
    const u = new URL(raw);
    const path = u.pathname.replace(/\/+$/, '');
    return `${u.host}${path}`.toLowerCase();
  } catch {
    return raw.toLowerCase().split('?')[0].split('#')[0].replace(/\/+$/, '');
  }
}

function fingerprintItem(source, item) {
  const url = (item.canonicalUrl || item.couponUrl || '').trim();
  if (url) return `${source}|${normalizeFingerprintUrl(url)}`;
  return `${source}|${normalizeForFingerprint(item.title)}`;
}

function computeHeadFingerprints(source, items, limit = 10) {
  return items.slice(0, limit).map((i) => fingerprintItem(source, i));
}

function headMatchesPrevious(previous, current) {
  if (!previous || previous.length === 0) return false;
  if (!current || current.length === 0) return false;
  if (previous.length < 5 || current.length < 5) return false;
  const depth = Math.min(10, previous.length, current.length);
  for (let i = 0; i < depth; i++) {
    if (previous[i] !== current[i]) return false;
  }
  return true;
}

function decideShouldStopSource(input) {
  if (input.page !== 1) return { shouldStopSource: false, reason: 'not page 1' };
  if (!input.success) return { shouldStopSource: false, reason: 'source scrape did not succeed' };
  if (input.parsedCount <= 0) return { shouldStopSource: false, reason: 'no items parsed' };
  if (input.errCount > 0) return { shouldStopSource: false, reason: 'errors during scrape' };
  if (!input.headMatchesPrevious) return { shouldStopSource: false, reason: 'head fingerprint missing or changed' };
  if (input.newCount > 0 || input.updatedCount > 0 || input.reactivatedCount > 0) {
    return { shouldStopSource: false, reason: 'new/updated/reactivated items found' };
  }
  return { shouldStopSource: true, reason: 'source head unchanged and no new/updated items' };
}

// --- helpers ---------------------------------------------------------------

function makeStopInput(overrides = {}) {
  return {
    page: 1,
    success: true,
    parsedCount: 10,
    errCount: 0,
    newCount: 0,
    updatedCount: 0,
    reactivatedCount: 0,
    headMatchesPrevious: true,
    ...overrides,
  };
}

function urls(n, base = 'https://www.udemyfreebies.com/free-udemy-course/c') {
  return Array.from({ length: n }, (_, i) => ({ canonicalUrl: `${base}${i}`, title: `Course ${i}` }));
}

// --- fingerprint stability -------------------------------------------------

test('fingerprint ignores query string, hash and trailing slash', () => {
  const a = fingerprintItem('udemyfreebies', { canonicalUrl: 'https://x.com/course/abc/', title: 'A' });
  const b = fingerprintItem('udemyfreebies', { canonicalUrl: 'https://x.com/course/abc?couponCode=Z#top', title: 'A' });
  assert.equal(a, b);
});

test('fingerprint falls back to source + normalized title without a URL', () => {
  const fp = fingerprintItem('studybullet', { title: 'Hello, World!' });
  assert.equal(fp, 'studybullet|helloworld');
});

test('fingerprint prefers canonical URL over title', () => {
  const fp = fingerprintItem('studybullet', { canonicalUrl: 'https://studybullet.com/course/x', title: 'Anything' });
  assert.equal(fp, 'studybullet|studybullet.com/course/x');
});

// --- headMatchesPrevious ---------------------------------------------------

test('no previous checkpoint never matches', () => {
  const cur = computeHeadFingerprints('udemyfreebies', urls(10));
  assert.equal(headMatchesPrevious(null, cur), false);
  assert.equal(headMatchesPrevious([], cur), false);
});

test('identical heads match', () => {
  const cur = computeHeadFingerprints('udemyfreebies', urls(10));
  assert.equal(headMatchesPrevious(cur, cur), true);
});

test('tail change is conservative: full-depth ordered match required when both heads have >= 10', () => {
  const prev = computeHeadFingerprints('udemyfreebies', urls(10));
  // Keep first 5, replace last 5 entirely. Both heads are length 10, so all 10
  // leading fingerprints must match in order -> a tail change is NOT a match.
  const changedTail = urls(5).concat(urls(5, 'https://www.udemyfreebies.com/free-udemy-course/x'));
  const cur = computeHeadFingerprints('udemyfreebies', changedTail);
  assert.equal(headMatchesPrevious(prev, cur), false);
});

test('exact ordered first-5 match (short heads) matches', () => {
  // When both heads are exactly 5 long, an ordered first-5 match is sufficient.
  const prev = computeHeadFingerprints('udemyfreebies', urls(5));
  const cur = computeHeadFingerprints('udemyfreebies', urls(5));
  assert.equal(headMatchesPrevious(prev, cur), true);
});

test('one new item at top breaks the ordered match (NEW,c0..c8 vs c0..c9)', () => {
  // previous first 10 = c0..c9 ; current first 10 = NEW,c0..c8
  const prev = computeHeadFingerprints('udemyfreebies', urls(10));
  const shifted = [{ canonicalUrl: 'https://www.udemyfreebies.com/free-udemy-course/NEW', title: 'New' }]
    .concat(urls(9));
  const cur = computeHeadFingerprints('udemyfreebies', shifted);
  // 9 of 10 overlap, but order shifted -> must be false (conservative).
  assert.equal(headMatchesPrevious(prev, cur), false);
});

test('heads shorter than 5 fingerprints never match', () => {
  const prev = computeHeadFingerprints('udemyfreebies', urls(4));
  const cur = computeHeadFingerprints('udemyfreebies', urls(4));
  assert.equal(headMatchesPrevious(prev, cur), false);
});

test('head changed (3 new at top) does not match', () => {
  const prev = computeHeadFingerprints('udemyfreebies', urls(10));
  const changed = urls(3, 'https://www.udemyfreebies.com/free-udemy-course/NEW')
    .concat(urls(7));
  const cur = computeHeadFingerprints('udemyfreebies', changed);
  assert.equal(headMatchesPrevious(prev, cur), false);
});

// --- decideShouldStopSource ------------------------------------------------

test('stops only when head unchanged and nothing new/updated', () => {
  const d = decideShouldStopSource(makeStopInput());
  assert.equal(d.shouldStopSource, true);
  assert.equal(d.reason, 'source head unchanged and no new/updated items');
});

test('never stops on page > 1', () => {
  assert.equal(decideShouldStopSource(makeStopInput({ page: 2 })).shouldStopSource, false);
});

test('first run (no checkpoint -> headMatchesPrevious false) does not stop', () => {
  assert.equal(decideShouldStopSource(makeStopInput({ headMatchesPrevious: false })).shouldStopSource, false);
});

test('parsedCount=0 does not stop', () => {
  assert.equal(decideShouldStopSource(makeStopInput({ parsedCount: 0 })).shouldStopSource, false);
});

test('errCount>0 does not stop', () => {
  assert.equal(decideShouldStopSource(makeStopInput({ errCount: 1 })).shouldStopSource, false);
});

test('source failure does not stop', () => {
  assert.equal(decideShouldStopSource(makeStopInput({ success: false })).shouldStopSource, false);
});

test('head changed does not stop even when newCount=0', () => {
  const d = decideShouldStopSource(makeStopInput({ headMatchesPrevious: false, newCount: 0 }));
  assert.equal(d.shouldStopSource, false);
});

test('any new/updated/reactivated item prevents stop', () => {
  assert.equal(decideShouldStopSource(makeStopInput({ newCount: 1 })).shouldStopSource, false);
  assert.equal(decideShouldStopSource(makeStopInput({ updatedCount: 1 })).shouldStopSource, false);
  assert.equal(decideShouldStopSource(makeStopInput({ reactivatedCount: 1 })).shouldStopSource, false);
});
