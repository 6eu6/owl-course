import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';
import { getAllCourses, getAllCategories, countCourses } from '@/lib/queries';
import { getSiteSettings } from '@/lib/settings';
import { normalizeLocale, localizeDuration } from '@/lib/i18n';
import { withCourseDefaults } from '@/lib/course-display';
import { COURSES_TAG, COURSES_REVALIDATE } from '@/lib/cache';

interface PayloadOpts {
  locale: string;
  page: number;
  limit: number;
  search: string;
  category: string;
  source: string;
  sort: string;
  freeForever: string;
}

// GET /api/courses - List courses with pagination, filtering, search
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const opts: PayloadOpts = {
      locale: normalizeLocale(searchParams.get('locale') || 'en'),
      page: Math.max(parseInt(searchParams.get('page') || '1'), 1),
      limit: Math.max(parseInt(searchParams.get('limit') || '12'), 1),
      search: searchParams.get('search') || '',
      category: searchParams.get('category') || '',
      source: searchParams.get('source') || '',
      sort: searchParams.get('sort') || 'newest',
      freeForever: searchParams.get('freeForever') || '',
    };

    // Free-text search is user-typed and unbounded, so it bypasses the cache to
    // avoid cache-key explosion. Every other listing (default, category, sort,
    // pagination) is served from the Data Cache and only touches the database
    // once per revalidation window — making reads independent of visitor count.
    const payload = opts.search
      ? await buildCoursesPayload(opts)
      : await getCoursesPayloadCached(opts);

    return NextResponse.json(payload);
  } catch (e) {
    console.error('Courses API error:', e);
    return NextResponse.json(emptyResponse(String(e)), { status: 500 });
  }
}

// Cached variant: identical output, but the database is consulted at most once
// per (locale, page, category, source, sort, freeForever) per revalidation
// window. Invalidated on demand via revalidateCourses() after a scrape/translate.
const getCoursesPayloadCached = unstable_cache(
  (opts: PayloadOpts) => buildCoursesPayload(opts),
  ['courses-payload'],
  { tags: [COURSES_TAG], revalidate: COURSES_REVALIDATE },
);

async function buildCoursesPayload(opts: PayloadOpts) {
  const { locale, page, limit, search, category, source, sort, freeForever } = opts;

  let settings: { site_name: string; site_description: string; courses_per_page: number };
  try {
    settings = await getSiteSettings();
  } catch {
    settings = { site_name: 'Learn Plus Courses', site_description: '', courses_per_page: 12 };
  }

  const categories = await getAllCategories();

  // -------------------------------------------------------------------------
  // Arabic listing: CourseTranslation is the BASE query, not an overlay.
  // Only rows with status='translated' on a published course are returned, so
  // every Arabic card carries a real Arabic slug + title and opens 200 — never
  // an English slug that would 404 on /ar/course/<slug>.
  // -------------------------------------------------------------------------
  if (locale === 'ar') {
    return await arabicCoursesPayload({
      page,
      limit,
      search,
      category,
      source,
      sort,
      freeForever,
      categories,
      settings,
    });
  }

  // -------------------------------------------------------------------------
  // English listing: original Course rows (unchanged behavior).
  // -------------------------------------------------------------------------
  const { courses, total } = await getAllCourses({ page, limit, search, category, source, sort });
  const totalCourses = await countCourses({ isPublished: true });

  return {
    success: true,
    locale,
    courses: courses.map((raw) => {
      const c = withCourseDefaults(raw);
      return {
        id: c.id,
        title: c.title,
        slug: c.slug,
        description: c.description?.slice(0, 200) || '',
        instructor: c.instructor || '',
        category: c.category,
        imageUrl: c.imageUrl,
        image_url: c.imageUrl,
        rating: c.rating || null,
        students_count: c.studentsCount || null,
        original_price: c.originalPrice || null,
        language: c.language || null,
        duration: c.duration || null,
        couponExpiresAt: c.couponExpiresAt?.toISOString() || null,
        isFreeForever: c.isFreeForever || false,
        couponVerified: c.couponVerified || false,
        scraped_at: c.scrapedAt,
      };
    }),
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    filters: {
      categories,
      current_category: category,
      current_search: search,
      current_source: source,
      current_sort: sort,
      current_freeForever: freeForever,
    },
    stats: { total_courses: totalCourses },
    settings,
  };
}

// ---------------------------------------------------------------------------
// Arabic-only listing driven by CourseTranslation.
// ---------------------------------------------------------------------------
async function arabicCoursesPayload(opts: {
  page: number;
  limit: number;
  search: string;
  category: string;
  source: string;
  sort: string;
  freeForever: string;
  categories: unknown;
  settings: { site_name: string; site_description: string; courses_per_page: number };
}) {
  const { page, limit, search, category, source, sort, freeForever, categories, settings } = opts;
  const skip = (page - 1) * limit;

  // Course-side constraints live under the `course` relation.
  const courseFilter: Record<string, unknown> = { isPublished: true };
  if (source) courseFilter.source = source;
  if (freeForever === 'true') courseFilter.isFreeForever = true;

  const and: Array<Record<string, unknown>> = [];
  if (category) {
    // Match either the translated (Arabic) category or the original course category,
    // since the category filter chips are keyed on the original category name.
    and.push({ OR: [{ category }, { course: { category } }] });
  }
  if (search) {
    // Search the Arabic translation fields first; original course title is a
    // secondary match, but the row still must be an Arabic translated row.
    and.push({
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { metaTitle: { contains: search, mode: 'insensitive' } },
        { metaDescription: { contains: search, mode: 'insensitive' } },
        { course: { title: { contains: search, mode: 'insensitive' } } },
      ],
    });
  }

  const where: Record<string, unknown> = {
    locale: 'ar',
    status: 'translated',
    course: courseFilter,
  };
  if (and.length > 0) where.AND = and;

  // Sort on the related course for numeric/date sorts; on the translation title
  // for alphabetical sort so /ar is ordered by the Arabic title.
  let orderBy: Record<string, unknown> = { course: { scrapedAt: 'desc' } };
  if (sort === 'oldest') orderBy = { course: { scrapedAt: 'asc' } };
  else if (sort === 'rating') orderBy = { course: { rating: 'desc' } };
  else if (sort === 'students') orderBy = { course: { studentsCount: 'desc' } };
  else if (sort === 'title') orderBy = { title: 'asc' };

  let rows: any[] = [];
  let total = 0;
  let totalCourses = 0;
  try {
    [rows, total, totalCourses] = await Promise.all([
      (db as any).courseTranslation.findMany({ where, include: { course: true }, orderBy, skip, take: limit }),
      (db as any).courseTranslation.count({ where }),
      (db as any).courseTranslation.count({
        where: { locale: 'ar', status: 'translated', course: { isPublished: true } },
      }),
    ]);
  } catch {
    // i18n table not ready — return an empty Arabic listing rather than 500.
    rows = [];
    total = 0;
    totalCourses = 0;
  }

  return {
    success: true,
    locale: 'ar',
    courses: rows.map((r) => {
      const c = withCourseDefaults(r.course);
      return {
        id: c.id,
        title: r.title,
        slug: r.slug,
        description: (r.description || '').slice(0, 200),
        instructor: c.instructor || '',
        category: r.category || c.category,
        imageUrl: c.imageUrl,
        image_url: c.imageUrl,
        rating: c.rating || null,
        students_count: c.studentsCount || null,
        original_price: c.originalPrice || null,
        language: c.language || null,
        duration: c.duration ? localizeDuration(c.duration, 'ar') : null,
        couponExpiresAt: c.couponExpiresAt?.toISOString() || null,
        isFreeForever: c.isFreeForever || false,
        couponVerified: c.couponVerified || false,
        scraped_at: c.scrapedAt,
      };
    }),
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    filters: {
      categories,
      current_category: category,
      current_search: search,
      current_source: source,
      current_sort: sort,
      current_freeForever: freeForever,
    },
    stats: { total_courses: totalCourses },
    settings,
  };
}

function emptyResponse(error: string) {
  return {
    success: false,
    courses: [],
    pagination: { page: 1, limit: 12, total: 0, total_pages: 0 },
    filters: {
      categories: [],
      current_category: '',
      current_search: '',
      current_source: '',
      current_sort: 'newest',
      current_freeForever: '',
    },
    stats: { total_courses: 0 },
    settings: { site_name: 'Learn Plus Courses', site_description: '', courses_per_page: 12 },
    error,
  };
}
