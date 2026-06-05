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

/** Normalize title for dedup comparison */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

const CATEGORY_MAP: Record<string, string[]> = {
  'تطوير الويب': ['web', 'html', 'css', 'javascript', 'react', 'angular', 'vue', 'node', 'frontend', 'backend', 'full stack', 'wordpress', 'php', 'django', 'flask', 'laravel', 'next.js', 'nextjs', 'typescript', 'tailwind', 'html5', 'css3', 'bootstrap', 'jquery', 'express', 'svelte', 'graphql', 'rest api'],
  'تطوير التطبيقات': ['mobile', 'android', 'ios', 'flutter', 'react native', 'swift', 'kotlin', 'app development', 'swiftui', 'xcode'],
  'علوم البيانات والذكاء الاصطناعي': ['data science', 'machine learning', 'deep learning', 'ai', 'artificial intelligence', 'nlp', 'neural', 'tensorflow', 'pytorch', 'chatgpt', 'gpt', 'llm', 'data analysis', 'computer vision', 'opencv'],
  'بايثون': ['python', 'django', 'flask', 'pandas', 'numpy', 'matplotlib', 'scipy', 'python 3', 'tkinter'],
  'السحابة وال devops': ['cloud', 'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'devops', 'terraform', 'ci/cd', 'linux', 'vmware', 'jenkins', 'ansible'],
  'الأمن السيبراني': ['security', 'cybersecurity', 'ethical hacking', 'penetration', 'network security', 'infosec', 'ceh', 'hacking', 'cyber', 'bug bounty', ' kali linux'],
  'التصميم': ['design', 'graphic', 'ui/ux', 'ux', 'figma', 'photoshop', 'illustrator', 'adobe', 'canva', 'blender', '3d', 'after effects', 'premiere', 'video editing', 'revit', 'autocad', 'autodesk', 'invision', 'sketch'],
  'التسويق الرقمي': ['marketing', 'seo', 'sem', 'social media marketing', 'digital marketing', 'google ads', 'facebook ads', 'branding', 'personal branding', 'email marketing', 'content marketing'],
  'إدارة الأعمال': ['business', 'management', 'project management', 'entrepreneurship', 'finance', 'accounting', 'excel', 'startup', 'agile', 'scrum', 'product management', 'leadership', 'hr', 'human resources'],
  'البرمجة و IT': ['it', 'software', 'comptia', 'git', 'database', 'sql', 'oracle', 'networking', 'java', 'c++', 'c#', '.net', 'microsoft', 'power bi', 'tableau', 'rust', 'go', 'golang', 'assembly'],
  'التصوير والفيديو': ['photography', 'photo', 'camera', 'video', 'video editing', 'premiere', 'after effects', 'filmora', 'davinci', 'filmmaking', 'youtube', 'motion graphics'],
  'التطوير الشخصي': ['personal development', 'productivity', 'communication', 'leadership', 'motivation', 'mindset', 'life coaching', 'neuroscience', 'subconscious', 'brain', 'resume', 'cv', 'interview', 'time management'],
  'الموسيقى': ['music', 'guitar', 'piano', 'drums', 'singing', 'audio', 'music production', 'ableton', 'fl studio'],
  'اللغات': ['language', 'english', 'spanish', 'french', 'german', 'japanese', 'chinese', 'arabic', 'ielts', 'toefl'],
  'التمويل والمحاسبة': ['trading', 'forex', 'crypto', 'investment', 'stock', 'financial', 'accounting', 'bookkeeping', 'quickbooks', 'real estate'],
  'الصحة واللياقة': ['health', 'fitness', 'yoga', 'meditation', 'nutrition', 'diet', 'mental health', 'wellness'],
};

const CATEGORY_ICONS: Record<string, string> = {
  'تطوير الويب': '💻',
  'تطوير التطبيقات': '📱',
  'علوم البيانات والذكاء الاصطناعي': '🤖',
  'بايثون': '🐍',
  'السحابة وال devops': '☁️',
  'الأمن السيبراني': '🔒',
  'التصميم': '🎨',
  'التسويق الرقمي': '📢',
  'إدارة الأعمال': '💼',
  'البرمجة و IT': '⚙️',
  'التصوير والفيديو': '📷',
  'التطوير الشخصي': '🧠',
  'الموسيقى': '🎵',
  'اللغات': '🌍',
  'التمويل والمحاسبة': '💰',
  'الصحة واللياقة': '💪',
  'أخرى': '📚',
};

export function categorize(title: string, originalCategory: string = ''): string {
  const text = title.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_MAP)) {
    if (keywords.some(k => text.includes(k))) {
      return category;
    }
  }
  return 'أخرى';
}

export { CATEGORY_ICONS };

function enhanceImageUrl(imageUrl: string): string {
  if (!imageUrl) return imageUrl;
  try {
    if (imageUrl.includes('?')) {
      imageUrl = imageUrl.split('?')[0];
    }

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
  requirements: string;
  whoFor: string;
  whatLearn: string;
  lastUpdated: string | null;
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

    const $titleLink = $block.find('h4 a').first();
    const title = $titleLink.text().trim();
    const detailUrl = $titleLink.attr('href') || '';

    if (!title || title.length < 5) return;

    let imageUrl = '';
    const $img = $block.find('img').first();
    imageUrl = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy-src') || '';
    imageUrl = enhanceImageUrl(imageUrl);

    let category = '';
    const $cat = $block.find('.coupon-specility p').first();
    category = $cat.text().trim();

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

      if (icon.includes('fa-comment') && text) {
        language = text;
      }
      else if (icon.includes('fa-users') && text) {
        const enrollMatch = text.match(/Enroll:\s*([\d,]+)/i);
        if (enrollMatch) {
          studentsCount = parseInt(enrollMatch[1].replace(/,/g, ''));
        }
      }
      else if (icon.includes('fa-user') && !icon.includes('fa-users') && text) {
        instructor = text.trim();
      }
      else if (icon.includes('fa-star') && text) {
        const rateMatch = text.match(/Rate:\s*([\d.]+)\s*\/\s*([\d,]+)/i);
        if (rateMatch) {
          rating = parseFloat(rateMatch[1]);
          reviewCount = parseInt(rateMatch[2].replace(/,/g, ''));
        }
      }
      else if (icon.includes('fa-money') && text) {
        const priceMatch = text.match(/\$(?:<del>)?([\d,.]+)/i);
        if (priceMatch) {
          originalPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
        }
      }
    });

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
    const slugMatch = detailUrl.match(/free-udemy-course\/(.+?)$/);
    if (!slugMatch) return null;

    const outUrl = `https://www.udemyfreebies.com/out/${slugMatch[1]}`;

    const response = await fetch(outUrl, {
      headers: getRandomHeaders(),
      signal: AbortSignal.timeout(10000),
      redirect: 'manual',
    });

    const location = response.headers.get('location');
    if (!location || !location.includes('udemy.com')) {
      const followResp = await fetch(outUrl, {
        headers: getRandomHeaders(),
        signal: AbortSignal.timeout(10000),
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
// Step 2.5: Scrape course detail page from udemyfreebies.com
// Extracts: description, requirements, whoFor, duration/level from description
// ============================================

interface DetailPageData {
  description: string;
  requirements: string;
  whoFor: string;
  duration: string | null;
  lastUpdated: string | null;
}

async function scrapeDetailPage(detailUrl: string): Promise<DetailPageData> {
  const empty: DetailPageData = {
    description: '', requirements: '', whoFor: '', duration: null, lastUpdated: null,
  };

  try {
    const response = await fetch(detailUrl, {
      headers: getRandomHeaders(),
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    });

    if (!response.ok) return empty;

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract description - find the h3/h2 containing "Description" and get content after it
    let description = '';
    const $desc = $('h2, h3').filter(function() {
      return $(this).text().trim().toLowerCase() === 'description';
    });
    if ($desc.length > 0) {
 const $next = $desc.next();
 if ($next.length > 0) {
   description = $next.text().trim();
   // Clean up HTML entities
   description = description.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
   description = description.replace(/\s+/g, ' ').trim();
 }
    }

    // Extract requirements
    let requirements = '';
    const $req = $('h2, h3').filter(function() {
      return $(this).text().trim().toLowerCase() === 'requirements';
    });
    if ($req.length > 0) {
      const $next = $req.next();
      if ($next.length > 0) {
        requirements = $next.text().trim().replace(/\s+/g, ' ');
      }
    }

    // Extract "Who this course is for"
    let whoFor = '';
    const $who = $('h2, h3').filter(function() {
      const text = $(this).text().trim().toLowerCase();
      return text.includes('who this course is for') || text.includes('who this course for');
    });
    if ($who.length > 0) {
      const $next = $who.next();
      if ($next.length > 0) {
        whoFor = $next.text().trim().replace(/\s+/g, ' ');
      }
    }

    // Parse duration and lastUpdated from description
    let duration: string | null = null;
    let lastUpdated: string | null = null;

    if (description) {
      // Try to find duration patterns like "3.5 hours", "5 hours", "2h 30m"
      const durMatch = description.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr)\b/i);
      if (durMatch) {
        duration = `${durMatch[1]} hours`;
      } else {
        const minMatch = description.match(/(\d+)\s*(?:minutes?|mins?|min)\b/i);
        if (minMatch) {
          duration = `${minMatch[1]} min`;
        }
      }

      // Try to find last updated date like "Last updated: DECEMBER 2024"
      const dateMatch = description.match(/(?:last updated[:\s]*)(\w+\s+\d{4})/i);
      if (dateMatch) {
        lastUpdated = dateMatch[1].trim();
      }
    }

    return { description, requirements, whoFor, duration, lastUpdated };
  } catch {
    return empty;
  }
}

// ============================================
// Step 2.6: Udemy Fallback - try to get extra data from Udemy page
// Only for duration/level if udemyfreebies didn't provide it
// ============================================

async function scrapeUdemyFallback(udemyUrl: string): Promise<Partial<DetailPageData>> {
  const result: Partial<DetailPageData> = {};
  try {
    const resp = await fetch(udemyUrl, {
      headers: {
        ...getRandomHeaders(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    });

    if (!resp.ok) return result;

    const html = await resp.text();
    const $ = cheerio.load(html);

    // Udemy pages sometimes have structured data in script tags
    const scripts = $('script').toArray();
    for (const script of scripts) {
      const content = $(script).html() || '';

      // Look for JSON data with course info
      if (content.includes('content_length_video') || content.includes('num_lectures')) {
        try {
          // Try to extract JSON object
          const jsonMatch = content.match(/\{[^{}]*(?:content_length_video|num_lectures|instructional_level)[^{}]*\}/g);
          if (jsonMatch) {
            for (const jm of jsonMatch) {
              try {
                const parsed = JSON.parse(jm);
                if (!result.duration && parsed.content_length_video) {
                  const hours = Math.round(parsed.content_length_video / 3600 * 10) / 10;
                  result.duration = `${hours} hours`;
                }
                if (!result.duration && parsed.estimated_content_length) {
                  const hours = Math.round(parsed.estimated_content_length / 3600 * 10) / 10;
                  result.duration = `${hours} hours`;
                }
              } catch { /* skip */ }
            }
          }
        } catch { /* skip */ }
      }
    }

    // Also try extracting from text content
    const bodyText = $('body').text();
    if (!result.duration) {
      const durMatch = bodyText.match(/(\d+(?:\.\d+)?)\s*(?:total\s*)?(?:hours?|hrs?)\b/i);
      if (durMatch) result.duration = `${durMatch[1]} hours`;
    }

  } catch {
    // Fallback failed, not critical
  }
  return result;
}

// ============================================
// Step 3: Process course & save to DB
// ============================================

async function processCourse(
  course: ListingCourse,
  existingUrls: Set<string>,
  existingTitles: Set<string>
): Promise<{ saved: boolean; skipped?: string; data?: ScrapedCourseData }> {
  try {
    // Title-based dedup (fast, in-memory)
    const normTitle = normalizeTitle(course.title);
    if (existingTitles.has(normTitle)) {
      return { saved: false, skipped: 'duplicate-title' };
    }

    // Get Udemy URL with coupon
    const result = await extractUdemyUrl(course.detailUrl);
    if (!result) return { saved: false, skipped: 'no-redirect' };

    const { udemyUrl, couponCode } = result;

    // URL-based dedup
    if (existingUrls.has(udemyUrl)) {
      return { saved: false, skipped: 'duplicate-url' };
    }

    // Quick validation: check if coupon code exists and is reasonable
    if (!couponCode || couponCode.length < 4) {
      return { saved: false, skipped: 'invalid-coupon' };
    }

    // Step 2.5: Scrape detail page for full description, requirements, whoFor
    const detailData = await scrapeDetailPage(course.detailUrl);

    // Step 2.6: Udemy fallback for duration if not found
    let duration = detailData.duration;
    if (!duration) {
      const udemyData = await scrapeUdemyFallback(udemyUrl);
      duration = udemyData.duration || null;
    }

    // Build course data with rich detail
    const courseData: ScrapedCourseData = {
      title: course.title,
      description: detailData.description || `تعلم ${course.title} مع هذه الدورة المجانية الشاملة. تشمل مهارات ${course.category} والتطبيقات العملية في العالم الحقيقي.`,
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
      duration,
      requirements: detailData.requirements,
      whoFor: detailData.whoFor,
      whatLearn: '',
      lastUpdated: detailData.lastUpdated,
      source: 'udemyfreebies',
    };

    // Save to database
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
      requirements: courseData.requirements,
      whoFor: courseData.whoFor,
      whatLearn: courseData.whatLearn,
      lastUpdated: courseData.lastUpdated,
      couponCode: courseData.couponCode,
      couponUrl: courseData.couponUrl,
    });

    if (dbResult.created) {
      existingUrls.add(udemyUrl);
      existingTitles.add(normTitle);
      return { saved: true, data: courseData };
    }

    return { saved: false, skipped: 'db-duplicate' };
  } catch {
    return { saved: false, skipped: 'error' };
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
  let invalidCount = 0;
  const allCourses: ScrapedCourseData[] = [];
  const errors: string[] = [];

  try {
    // Pre-load existing URLs AND titles for dedup
    const existingCourses = await db.course.findMany({
      select: { udemyUrl: true, title: true },
    });
    const existingUrls = new Set(existingCourses.map(c => c.udemyUrl));
    const existingTitles = new Set(existingCourses.map(c => normalizeTitle(c.title)));

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

    // Step 2: Process courses in batches
    const BATCH_SIZE = 5;
    for (let i = 0; i < allListedCourses.length; i += BATCH_SIZE) {
      const batch = allListedCourses.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(course => processCourse(course, existingUrls, existingTitles))
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          if (result.value.saved) {
            newCount++;
            allCourses.push(result.value.data!);
          } else if (result.value.skipped === 'duplicate-title' || result.value.skipped === 'duplicate-url' || result.value.skipped === 'db-duplicate') {
            dupCount++;
          } else if (result.value.skipped === 'invalid-coupon' || result.value.skipped === 'no-redirect') {
            invalidCount++;
            errCount++;
          } else {
            errCount++;
          }
        } else {
          errCount++;
        }
      }

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
    message: errors.slice(0, 5).join('; ') || `${newCount} new courses from ${maxPages} pages, ${dupCount} duplicates, ${invalidCount} invalid coupons`,
    duration,
  };
  await logScraperRun(logEntry).catch(() => {});

  return {
    source: 'udemyfreebies',
    status,
    newCount,
    dupCount,
    errCount,
    message: `${maxPages} pages → ${newCount} جديدة، ${dupCount} مكررة، ${invalidCount} كوبونات منتهية، ${errCount} أخطاء`,
    duration,
    courses: allCourses,
  };
}

// ============================================
// Cleanup: Remove duplicate courses from DB
// ============================================

export async function cleanupDuplicates(): Promise<{ removed: number }> {
  const allCourses = await db.course.findMany({
    select: { id: true, title: true, udemyUrl: true },
  });

  const seenTitles = new Map<string, string>(); // normalized -> id of first
  const toRemove: string[] = [];

  for (const course of allCourses) {
    const norm = normalizeTitle(course.title);
    if (seenTitles.has(norm)) {
      toRemove.push(course.id);
    } else {
      seenTitles.set(norm, course.id);
    }
  }

  if (toRemove.length > 0) {
    await db.course.deleteMany({
      where: { id: { in: toRemove } },
    });
  }

  return { removed: toRemove.length };
}

// ============================================
// Main Entry Point
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

  // Clean duplicates before scraping
  await cleanupDuplicates().catch(() => {});

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
