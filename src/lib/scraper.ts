import * as cheerio from 'cheerio';
import { db } from '@/lib/db';
import { logScraperRun, createCourseIfNotExists, type ScraperLogEntry } from './mongodb';

// ============================================
// Utility Functions
// ============================================

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .slice(0, 120) || 'course';
}

function categorize(title: string, originalCategory: string = ''): string {
  const text = title.toLowerCase();
  const categories: Record<string, string[]> = {
    'Web Development': ['web', 'html', 'css', 'javascript', 'react', 'angular', 'vue', 'node', 'frontend', 'backend', 'full stack', 'wordpress', 'php', 'django', 'flask', 'laravel', 'next.js', 'nextjs', 'typescript', 'tailwind', 'html5', 'css3', 'bootstrap', 'jquery'],
    'Mobile Development': ['mobile', 'android', 'ios', 'flutter', 'react native', 'swift', 'kotlin', 'app development', 'swiftui'],
    'Data Science': ['data science', 'machine learning', 'deep learning', 'ai', 'artificial intelligence', 'nlp', 'neural', 'tensorflow', 'pytorch', 'chatgpt', 'gpt', 'llm', 'data analysis'],
    'Python': ['python', 'django', 'flask', 'pandas', 'numpy', 'matplotlib', 'scipy', 'python 3'],
    'Cloud & DevOps': ['cloud', 'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'devops', 'terraform', 'ci/cd', 'linux', 'vmware'],
    'Cybersecurity': ['security', 'cybersecurity', 'ethical hacking', 'penetration', 'network security', 'infosec', 'ceh', 'hacking', 'cyber'],
    'Design': ['design', 'graphic', 'ui/ux', 'ux', 'figma', 'photoshop', 'illustrator', 'adobe', 'canva', 'blender', '3d', 'after effects', 'premiere', 'video editing', 'revit', 'autocad', 'autodesk'],
    'Marketing': ['marketing', 'seo', 'sem', 'social media marketing', 'digital marketing', 'google ads', 'facebook ads', 'branding', 'personal branding'],
    'Business': ['business', 'management', 'project management', 'entrepreneurship', 'finance', 'accounting', 'excel', 'startup', 'agile', 'scrum', 'product management', 'leadership'],
    'IT & Software': ['it', 'software', 'comptia', 'linux', 'git', 'database', 'sql', 'oracle', 'networking', 'java', 'c++', 'c#', '.net', 'microsoft', 'power bi', 'tableau'],
    'Photography & Video': ['photography', 'photo', 'camera', 'video', 'video editing', 'premiere', 'after effects', 'filmora', 'davinci', 'filmmaking'],
    'Personal Development': ['personal development', 'productivity', 'communication', 'leadership', 'motivation', 'mindset', 'life coaching', 'neuroscience', 'subconscious', 'brain', 'resume', 'cv', 'interview'],
    'Music': ['music', 'guitar', 'piano', 'drums', 'singing', 'audio', 'music production', 'ableton'],
    'Language': ['language', 'english', 'spanish', 'french', 'german', 'japanese', 'chinese', 'arabic', 'ielts', 'toefl'],
    'Finance & Accounting': ['trading', 'forex', 'crypto', 'investment', 'stock', 'financial', 'accounting', 'bookkeeping', 'quickbooks'],
    'Health & Fitness': ['health', 'fitness', 'yoga', 'meditation', 'nutrition', 'diet', 'mental health', 'wellness'],
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(k => text.includes(k))) {
      return category;
    }
  }
  return originalCategory || 'Other';
}

function enhanceImageUrl(imageUrl: string): string {
  if (!imageUrl) return imageUrl;
  try {
    // Remove query parameters
    if (imageUrl.includes('?')) {
      imageUrl = imageUrl.split('?')[0];
    }

    // Upgrade Udemy CDN image quality from small to high-res
    if (imageUrl.includes('udemycdn.com')) {
      const replacements: Record<string, string> = {
        '/50x50/': '/750x422/',
        '/100x100/': '/750x422/',
        '/240x135/': '/750x422/',
        '/304x171/': '/750x422/',
        '/480x270/': '/750x422/',
        '/640x360/': '/750x422/',
      };
      for (const [old, nw] of Object.entries(replacements)) {
        if (imageUrl.includes(old)) {
          return imageUrl.replace(old, nw);
        }
      }
      // Try regex for any NxN pattern
      imageUrl = imageUrl.replace(/\/course\/\d+x\d+\//, '/course/750x422/');
    }
    return imageUrl;
  } catch {
    return imageUrl;
  }
}

function extractCouponCode(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('couponCode') || urlObj.searchParams.get('coupon') || '';
  } catch {
    return '';
  }
}

// ============================================
// Types
// ============================================

interface ListingCourse {
  title: string;
  detailUrl: string;
  imageUrl: string;
  category: string;
  language: string;
  instructor: string;
  rating: number | null;
  reviewCount: number | null;
  studentsCount: number | null;
  originalPrice: number | null;
  date: string;
}

interface ScrapedCourseData {
  title: string;
  description: string;
  instructor: string;
  category: string;
  imageUrl: string;
  udemyUrl: string;
  couponUrl: string;
  couponCode: string;
  rating: number | null;
  studentsCount: number | null;
  originalPrice: string | null;
  language: string | null;
  duration: string | null;
  source: string;
}

interface SourceResult {
  source: string;
  status: 'success' | 'error' | 'partial';
  newCount: number;
  dupCount: number;
  errCount: number;
  message: string;
  duration: number;
  courses: ScrapedCourseData[];
}

// ============================================
// Random User-Agent rotation
// ============================================

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
];

function getRandomHeaders(): Record<string, string> {
  return {
    'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
  };
}

// ============================================
// Step 1: Fetch listing page & extract courses
// ============================================

function extractCoursesFromPage(html: string, pageNum: number): ListingCourse[] {
  const $ = cheerio.load(html);
  const courses: ListingCourse[] = [];

  $('div.theme-block').each((_, el) => {
    const $block = $(el);

    // Title & detail URL from h4 > a
    const $titleLink = $block.find('h4 a').first();
    const title = $titleLink.text().trim();
    const detailUrl = $titleLink.attr('href') || '';

    if (!title || title.length < 5) return;

    // Image - enhance quality
    let imageUrl = '';
    const $img = $block.find('img').first();
    imageUrl = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy-src') || '';
    imageUrl = enhanceImageUrl(imageUrl);

    // Category from coupon-specility
    let category = '';
    const $cat = $block.find('.coupon-specility p').first();
    category = $cat.text().trim();

    // Extract extra details from coupon-details-extra-3
    let language = '';
    let instructor = '';
    let rating: number | null = null;
    let reviewCount: number | null = null;
    let studentsCount: number | null = null;
    let originalPrice: number | null = null;

    const $extras = $block.find('.coupon-details-extra-3 p');
    $extras.each((_, pEl) => {
      const text = $(pEl).text().trim();
      const icon = $(pEl).find('i').attr('class') || '';

      // Language (fa-comment icon)
      if (icon.includes('fa-comment') && text) {
        language = text;
      }
      // Students (fa-users icon) — MUST check BEFORE fa-user since fa-users contains fa-user
      else if (icon.includes('fa-users') && text) {
        const enrollMatch = text.match(/Enroll:\s*([\d,]+)/i);
        if (enrollMatch) {
          studentsCount = parseInt(enrollMatch[1].replace(/,/g, ''));
        }
      }
      // Instructor (fa-user icon, but NOT fa-users)
      else if (icon.includes('fa-user') && !icon.includes('fa-users') && text) {
        instructor = text.trim();
      }
      // Rating (fa-star icon)
      else if (icon.includes('fa-star') && text) {
        const rateMatch = text.match(/Rate:\s*([\d.]+)\s*\/\s*([\d,]+)/i);
        if (rateMatch) {
          rating = parseFloat(rateMatch[1]);
          reviewCount = parseInt(rateMatch[2].replace(/,/g, ''));
        }
      }
      // Price (fa-money icon)
      else if (icon.includes('fa-money') && text) {
        const priceMatch = text.match(/\$(?:<del>)?([\d,.]+)/i);
        if (priceMatch) {
          originalPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
        }
      }
    });

    // Date
    const $date = $block.find('small.text-muted').first();
    const date = $date.text().trim() || '';

    courses.push({
      title,
      detailUrl: detailUrl.startsWith('http') ? detailUrl : `https://www.udemyfreebies.com${detailUrl}`,
      imageUrl,
      category: categorize(title, category),
      language,
      instructor,
      rating,
      reviewCount,
      studentsCount,
      originalPrice,
      date,
    });
  });

  return courses;
}

async function fetchListingPage(pageNum: number): Promise<{ courses: ListingCourse[]; hasMore: boolean }> {
  const url = pageNum === 1
    ? 'https://www.udemyfreebies.com/'
    : `https://www.udemyfreebies.com/free-udemy-courses/${pageNum}`;

  const response = await fetch(url, {
    headers: getRandomHeaders(),
    signal: AbortSignal.timeout(30000),
    redirect: 'follow',
  });

  if (!response.ok) {
    if (response.status === 404) return { courses: [], hasMore: false };
    throw new Error(`HTTP ${response.status} for page ${pageNum}`);
  }

  const html = await response.text();
  const courses = extractCoursesFromPage(html, pageNum);

  // Check if there are more pages by looking for pagination
  const $ = cheerio.load(html);
  const nextLinks = $('a[href*="/free-udemy-courses/"]').length;
  const hasMore = courses.length > 0 && nextLinks > 0;

  return { courses, hasMore };
}

// ============================================
// Step 2: Follow /out/ redirect to get Udemy URL
// ============================================

async function extractUdemyUrl(detailUrl: string): Promise<{ udemyUrl: string; couponCode: string } | null> {
  try {
    // Extract the slug from the detail URL
    // e.g., https://www.udemyfreebies.com/free-udemy-course/design-engaging-products-using-design-thinking
    // => /out/design-engaging-products-using-design-thinking
    const slugMatch = detailUrl.match(/free-udemy-course\/(.+?)$/);
    if (!slugMatch) return null;

    const outUrl = `https://www.udemyfreebies.com/out/${slugMatch[1]}`;

    // Follow the redirect - use redirect: 'manual' to capture the Location header
    // This is faster than downloading the redirect target body
    const response = await fetch(outUrl, {
      headers: getRandomHeaders(),
      signal: AbortSignal.timeout(8000),
      redirect: 'manual',
    });

    // Get redirect location
    const location = response.headers.get('location');
    if (!location || !location.includes('udemy.com')) {
      // Fallback: try with redirect follow
      const followResp = await fetch(outUrl, {
        headers: getRandomHeaders(),
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      });
      const finalUrl = followResp.url;
      if (!finalUrl || !finalUrl.includes('udemy.com')) return null;
      const couponCode = extractCouponCode(finalUrl);
      if (!couponCode) return null;
      return { udemyUrl: finalUrl, couponCode };
    }

    const couponCode = extractCouponCode(location);
    if (!couponCode) return null;

    return { udemyUrl: location, couponCode };
  } catch {
    return null;
  }
}

// ============================================
// Step 3: Process course & save to DB
// ============================================

async function processCourse(
  course: ListingCourse,
  existingUrls: Set<string>
): Promise<{ saved: boolean; data?: ScrapedCourseData }> {
  try {
    // Get Udemy URL with coupon by following /out/ redirect
    const result = await extractUdemyUrl(course.detailUrl);
    if (!result) return { saved: false };

    const { udemyUrl, couponCode } = result;

    // Quick dedup check (in-memory, fast)
    if (existingUrls.has(udemyUrl)) return { saved: false };

    // Build course data
    const courseData: ScrapedCourseData = {
      title: course.title,
      description: `Learn ${course.title} with this comprehensive free course. Topics include ${course.category.toLowerCase()} skills and real-world applications.`,
      instructor: course.instructor,
      category: course.category,
      imageUrl: course.imageUrl,
      udemyUrl,
      couponUrl: udemyUrl,
      couponCode,
      rating: course.rating,
      studentsCount: course.studentsCount,
      originalPrice: course.originalPrice ? `$${course.originalPrice.toFixed(2)}` : null,
      language: course.language || null,
      duration: null, // Not available on listing page
      source: 'udemyfreebies',
    };

    // Save to database (with DB-level dedup)
    const dbResult = await createCourseIfNotExists({
      title: courseData.title,
      slug: slugify(courseData.title),
      description: courseData.description,
      instructor: courseData.instructor,
      category: courseData.category,
      imageUrl: courseData.imageUrl,
      udemyUrl: courseData.udemyUrl,
      source: courseData.source,
      rating: courseData.rating,
      studentsCount: courseData.studentsCount,
      originalPrice: courseData.originalPrice,
      language: courseData.language,
      duration: courseData.duration,
      couponCode: courseData.couponCode,
      couponUrl: courseData.couponUrl,
    });

    if (dbResult.created) {
      // Add to in-memory set for subsequent dedup
      existingUrls.add(udemyUrl);
      return { saved: true, data: courseData };
    }

    return { saved: false };
  } catch {
    return { saved: false };
  }
}

// ============================================
// Main UdemyFreebies Scraper (Smart & Parallel)
// ============================================

async function scrapeUdemyFreebies(maxPages: number = 5): Promise<SourceResult> {
  const start = Date.now();
  let newCount = 0;
  let dupCount = 0;
  let errCount = 0;
  const allCourses: ScrapedCourseData[] = [];
  const errors: string[] = [];

  try {
    // Pre-load existing Udemy URLs for instant dedup
    const existingCourses = await db.course.findMany({
      select: { udemyUrl: true },
    });
    const existingUrls = new Set(existingCourses.map(c => c.udemyUrl));

    // Step 1: Fetch ALL listing pages IN PARALLEL
    const pagePromises = Array.from({ length: maxPages }, (_, i) =>
      fetchListingPage(i + 1).catch(err => {
        errors.push(`Page ${i + 1}: ${err}`);
        return { courses: [] as ListingCourse[], hasMore: false };
      })
    );

    const pageResults = await Promise.allSettled(pagePromises);
    const allListedCourses: ListingCourse[] = [];

    for (const result of pageResults) {
      if (result.status === 'fulfilled') {
        allListedCourses.push(...result.value.courses);
      }
    }

    // Step 2: Process each course (follow /out/ redirect & save)
    // Process in batches of 5 to avoid overwhelming the server
    const BATCH_SIZE = 5;
    for (let i = 0; i < allListedCourses.length; i += BATCH_SIZE) {
      const batch = allListedCourses.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(course => processCourse(course, existingUrls))
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          if (result.value.saved) {
            newCount++;
            allCourses.push(result.value.data!);
          } else {
            dupCount++;
          }
        } else {
          errCount++;
        }
      }

      // Small delay between batches to be respectful
      if (i + BATCH_SIZE < allListedCourses.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

  } catch (err) {
    errors.push(`Fatal: ${err}`);
    errCount++;
  }

  const duration = Date.now() - start;
  const status = errCount > 0 && newCount === 0 ? 'error' : errCount > 0 ? 'partial' : 'success';

  const logEntry: ScraperLogEntry = {
    source: 'udemyfreebies',
    status,
    newCount,
    dupCount,
    errCount,
    message: errors.slice(0, 5).join('; ') || `${newCount} new courses scraped from ${maxPages} pages`,
    duration,
  };
  await logScraperRun(logEntry).catch(() => {});

  return {
    source: 'udemyfreebies',
    status,
    newCount,
    dupCount,
    errCount,
    message: `Scraped ${maxPages} pages (${newCount} new, ${dupCount} duplicates, ${errCount} errors)`,
    duration,
    courses: allCourses,
  };
}

// ============================================
// Main Entry Point - Parallel Scraper
// ============================================

export interface ScrapeResults {
  udemyfreebies: SourceResult;
  totalNew: number;
  totalDup: number;
  totalErr: number;
  totalDuration: number;
}

export async function runFullScrape(options?: {
  pages?: number;
  sources?: string[];
}): Promise<ScrapeResults> {
  const totalStart = Date.now();
  const maxPages = options?.pages || 5;

  const udemyResult = await scrapeUdemyFreebies(maxPages);

  const totalDuration = Date.now() - totalStart;

  return {
    udemyfreebies: udemyResult,
    totalNew: udemyResult.newCount,
    totalDup: udemyResult.dupCount,
    totalErr: udemyResult.errCount,
    totalDuration,
  };
}

export { scrapeUdemyFreebies };
