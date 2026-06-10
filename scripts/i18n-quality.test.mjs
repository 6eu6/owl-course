// Runnable checks for the Arabic quality helpers and queue selection.
// Run: node scripts/i18n-quality.test.mjs
//
// These mirror the canonical logic in src/lib/course-translations.ts. Keep the
// regexes here in sync with that file when they change.

import assert from 'node:assert/strict';
import test from 'node:test';

// --- mirrors of src/lib/course-translations.ts -----------------------------

// normalizeArabicLatinSpacing: insert a space at the Arabic⇄Latin letter
// boundary; leave pure-English tokens and tatweel (الـAPI) untouched.
function normalizeArabicLatinSpacing(text) {
  return String(text || '')
    .replace(/([ء-ؿف-ي])([A-Za-z])/g, '$1 $2')
    .replace(/([A-Za-z])([ء-ؿف-ي])/g, '$1 $2')
    .replace(/[ \t]{2,}/g, ' ');
}

// containsUnexpectedScript: CJK / Japanese / Korean / Cyrillic / replacement /
// private-use must fail.
const DISALLOWED_SCRIPT =
  /[　-〿぀-ヿㇰ-ㇿ㐀-䶿一-鿿豈-﫿가-힯ᄀ-ᇿ㄰-㆏Ѐ-ԯ�-]/;
function containsUnexpectedScript(text) {
  return DISALLOWED_SCRIPT.test(String(text || ''));
}

// hasMalformedArabic: stacked marks, tatweel runs, or Arabic glued to Latin.
function hasMalformedArabic(text) {
  const t = String(text || '');
  if (/[ً-ٰٟ]{2,}/.test(t)) return true;
  if (/ـ{2,}/.test(t)) return true;
  if (/[ء-ؿف-ي][A-Za-z]|[A-Za-z][ء-ؿف-ي]/.test(t)) return true;
  return false;
}

// Tiered queue selection (missing → pending → failed), mirrors
// getCoursesMissingTranslation for locale='ar'.
function selectTiers(missing, pending, failed, take) {
  const out = [];
  const seen = new Set();
  const add = (rows) => {
    for (const c of rows) {
      if (seen.has(c)) continue;
      seen.add(c);
      out.push(c);
      if (out.length >= take) return;
    }
  };
  add(missing);
  if (out.length < take) add(pending);
  if (out.length < take) add(failed);
  return out;
}

// --- Task A: Arabic-Latin spacing is fixed ---------------------------------

test('normalizeArabicLatinSpacing inserts a space at glued boundaries', () => {
  assert.equal(normalizeArabicLatinSpacing('استخدمChatGPT'), 'استخدم ChatGPT');
  assert.equal(normalizeArabicLatinSpacing('تعلمPython'), 'تعلم Python');
  assert.equal(normalizeArabicLatinSpacing('واجهةAPI'), 'واجهة API');
  assert.equal(normalizeArabicLatinSpacing('Pythonللمبتدئين'), 'Python للمبتدئين');
});

test('normalizeArabicLatinSpacing leaves pure English tech terms unchanged', () => {
  for (const term of ['ChatGPT', 'API', 'Python', 'CySA+', 'CompTIA', 'Azure', 'AutoCAD', 'SOLIDWORKS']) {
    assert.equal(normalizeArabicLatinSpacing(term), term);
  }
  // Already-correct Arabic + Latin spacing is preserved.
  assert.equal(normalizeArabicLatinSpacing('تعلم Python مع API'), 'تعلم Python مع API');
  // Tatweel attachment (الـAPI) is intentionally preserved.
  assert.equal(normalizeArabicLatinSpacing('الـAPI'), 'الـAPI');
});

// --- Task B: dangerous scripts still fail ----------------------------------

test('containsUnexpectedScript rejects CJK / Japanese / Korean / Cyrillic / replacement', () => {
  assert.equal(containsUnexpectedScript('إعدادات 设置 تقنية'), true);   // Chinese
  assert.equal(containsUnexpectedScript('مرحبا こんにちは'), true);       // Japanese
  assert.equal(containsUnexpectedScript('مرحبا 안녕하세요'), true);        // Korean
  assert.equal(containsUnexpectedScript('إعدادات Привет'), true);        // Cyrillic
  assert.equal(containsUnexpectedScript('إعدادات � تقنية'), true);   // replacement char
  assert.equal(containsUnexpectedScript('إعدادات  تقنية'), true);   // private use
});

test('containsUnexpectedScript accepts Arabic + English tech terms', () => {
  assert.equal(containsUnexpectedScript('استخدم ChatGPT و API مع Python'), false);
  assert.equal(containsUnexpectedScript('احتراف Adobe Photoshop CC'), false);
});

// --- Task A+B combined: glued text fixed BEFORE validation, scripts still fail

test('glued Arabic-Latin is fixed before validation; CJK is not silently fixed', () => {
  const fixed = normalizeArabicLatinSpacing('استخدمChatGPT لبناء واجهةAPI');
  assert.equal(fixed, 'استخدم ChatGPT لبناء واجهة API');
  assert.equal(hasMalformedArabic(fixed), false);          // no longer flagged
  assert.equal(containsUnexpectedScript(fixed), false);

  // Normalizer must NOT remove dangerous scripts — they still fail the gate.
  const cjk = normalizeArabicLatinSpacing('إعدادات 设置');
  assert.equal(containsUnexpectedScript(cjk), true);
});

// --- Task D: missing rows are never starved by failed rows -----------------

test('queue selection returns missing rows first (no processed:0 while arMissing>0)', () => {
  // Many failed rows, a couple of fresh missing rows, limit=2.
  const missing = ['m1', 'm2', 'm3'];
  const failed = ['f1', 'f2', 'f3', 'f4', 'f5'];
  const picked = selectTiers(missing, [], failed, 2);
  assert.deepEqual(picked, ['m1', 'm2']);                  // missing wins, not starved
  assert.ok(picked.length > 0);                            // arMissing>0 -> processed>0
});

test('queue selection falls through to pending then failed when no missing', () => {
  assert.deepEqual(selectTiers([], ['p1'], ['f1', 'f2'], 3), ['p1', 'f1', 'f2']);
  assert.deepEqual(selectTiers([], [], ['f1'], 2), ['f1']);
  assert.deepEqual(selectTiers([], [], [], 2), []);        // genuinely empty -> processed:0 ok
});
