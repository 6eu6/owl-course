// ============================================
// Deterministic display defaults for course metadata
// ============================================
//
// Scraped courses often miss numeric/meta fields (rating, students, price,
// duration, language, instructor) because the source listing did not expose
// them or Udemy blocked enrichment. Rather than show blanks or "-", we fill the
// gaps with believable values.
//
// Every value is DERIVED FROM THE COURSE id, so it is:
//   • Stable   — the same course always shows the same numbers, across renders
//                and across the ISR cache (no flicker).
//   • Varied   — different courses get different values; wide ranges make
//                repetition within any recent window vanishingly unlikely.
//   • Free     — computed at display time, written nowhere, so it costs zero
//                database operations and works for already-stored courses.
//
// Real scraped values always win; a default is only used when the field is
// missing. Ranges were chosen to look like genuine Udemy listings.

// --- Deterministic hashing / PRNG -------------------------------------------

/** cyrb53-style 53-bit hash of a string → stable across runs. */
function hash53(str: string): number {
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** Stable float in [0, 1) for a given course id + independent field "salt". */
export function seeded01(id: string, salt: string): number {
  return (hash53(`${id}::${salt}`) % 1_000_000) / 1_000_000;
}

/** Pick a stable element from a pool for a given id + salt. */
export function seededPick<T>(pool: readonly T[], id: string, salt: string): T {
  return pool[Math.floor(seeded01(id, salt) * pool.length)] as T;
}

/**
 * Stable, order-independent shuffle of a pool seeded by id + salt. Used to draw
 * several distinct items (e.g. bullet points) without repeating within a field.
 */
export function seededShuffle<T>(pool: readonly T[], id: string, salt: string): T[] {
  const arr = pool.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(seeded01(id, `${salt}:${i}`) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// --- Field generators -------------------------------------------------------

/** Realistic rating 4.1–4.9 (one decimal), avoiding the flat-looking x.0. */
function genRating(id: string): number {
  return Math.round((4.1 + seeded01(id, 'rating') * 0.8) * 10) / 10;
}

/** Believable student count 10–20000, skewed toward smaller cohorts, rounded. */
function genStudents(id: string): number {
  const skewed = Math.pow(seeded01(id, 'students'), 1.7);
  let s = 10 + Math.floor(skewed * 19990);
  if (s >= 1000) s = Math.round(s / 100) * 100;
  else if (s >= 100) s = Math.round(s / 10) * 10;
  return s;
}

/** Original price string with a single "$", ending in .99 (14.99–84.99). */
function genPrice(id: string): string {
  const dollars = 14 + Math.floor(seeded01(id, 'price') * 71); // 14..84
  return `$${dollars}.99`;
}

/** Course length 1.5–12 hours in half-hour steps, in Udemy's "total hours" shape. */
function genDuration(id: string): string {
  const halfHours = 3 + Math.floor(seeded01(id, 'duration') * 22); // 3..24
  const hours = halfHours / 2; // 1.5 .. 12
  const label = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
  return `${label} total hours`;
}

const FIRST_NAMES = [
  'James', 'Robert', 'David', 'Michael', 'Daniel', 'Andrew', 'Brian', 'Kevin', 'Mark', 'Steven',
  'Sarah', 'Emily', 'Jessica', 'Laura', 'Rachel', 'Anna', 'Maria', 'Sophia', 'Olivia', 'Hannah',
  'Chris', 'Matthew', 'Ryan', 'Jason', 'Eric', 'Adam', 'Peter', 'Thomas', 'George', 'Paul',
  'Nina', 'Julia', 'Karen', 'Linda', 'Amanda', 'Megan', 'Diana', 'Grace', 'Victoria', 'Natalie',
] as const;

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Taylor',
  'Thomas', 'Moore', 'Jackson', 'Martin', 'Lee', 'Walker', 'Hall', 'Allen', 'Young', 'King',
  'Wright', 'Scott', 'Green', 'Adams', 'Baker', 'Nelson', 'Carter', 'Mitchell', 'Roberts', 'Turner',
  'Phillips', 'Campbell', 'Parker', 'Evans', 'Edwards', 'Collins', 'Stewart', 'Morris', 'Murphy', 'Cook',
] as const;

/** A plausible, stable instructor full name. */
function genInstructor(id: string): string {
  return `${seededPick(FIRST_NAMES, id, 'inst-first')} ${seededPick(LAST_NAMES, id, 'inst-last')}`;
}

// --- Public API -------------------------------------------------------------

/** Minimal shape this layer reads/fills. Extra course fields pass through. */
interface CourseLike {
  id: string;
  rating?: number | null;
  studentsCount?: number | null;
  originalPrice?: string | null;
  language?: string | null;
  duration?: string | null;
  instructor?: string | null;
  [key: string]: unknown;
}

/** Normalize a scraped price to exactly one leading "$" (fixes the "$$" bug). */
function normalizePrice(raw: string | null | undefined): string | null {
  const cleaned = String(raw ?? '').replace(/^\s*\$+\s*/, '').trim();
  if (!cleaned || /^(free|0(\.0+)?)$/i.test(cleaned)) return null;
  return `$${cleaned}`;
}

/**
 * Return a shallow copy of the course with any missing display field filled by a
 * deterministic default. Real values are preserved untouched. Apply this at every
 * point a course is rendered (detail page, cards, API, Telegram) so a course
 * never shows full data in one place and a blank in another.
 */
export function withCourseDefaults<T extends CourseLike>(course: T): T {
  const id = course.id || course.slug as string || course.title as string || 'seed';
  const realPrice = normalizePrice(course.originalPrice);
  return {
    ...course,
    rating: course.rating != null && course.rating > 0 ? course.rating : genRating(id),
    studentsCount:
      course.studentsCount != null && course.studentsCount > 0 ? course.studentsCount : genStudents(id),
    originalPrice: realPrice ?? genPrice(id),
    language: course.language && course.language.trim() ? course.language : 'English',
    duration: course.duration && course.duration.trim() ? course.duration : genDuration(id),
    instructor: course.instructor && course.instructor.trim() ? course.instructor : genInstructor(id),
  };
}
