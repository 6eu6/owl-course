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

function categorize(title: string, description: string = ''): string {
  const text = `${title} ${description}`.toLowerCase();
  const categories: Record<string, string[]> = {
    'Web Development': ['web', 'html', 'css', 'javascript', 'react', 'angular', 'vue', 'node', 'frontend', 'backend', 'full stack', 'wordpress', 'php', 'django', 'flask', 'laravel', 'next.js', 'nextjs', 'typescript', 'tailwind'],
    'Mobile Development': ['mobile', 'android', 'ios', 'flutter', 'react native', 'swift', 'kotlin', 'app development'],
    'Data Science': ['data science', 'machine learning', 'deep learning', 'ai', 'artificial intelligence', 'nlp', 'neural', 'tensorflow', 'pytorch', 'chatgpt', 'gpt', 'llm'],
    'Python': ['python', 'django', 'flask', 'pandas', 'numpy', 'matplotlib', 'scipy'],
    'Cloud & DevOps': ['cloud', 'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'devops', 'terraform', 'ci/cd'],
    'Cybersecurity': ['security', 'cybersecurity', 'ethical hacking', 'penetration', 'network security', 'infosec', 'ceh'],
    'Design': ['design', 'graphic', 'ui/ux', 'ux', 'figma', 'photoshop', 'illustrator', 'adobe', 'canva'],
    'Marketing': ['marketing', 'seo', 'sem', 'social media marketing', 'digital marketing', 'google ads', 'facebook ads'],
    'Business': ['business', 'management', 'project management', 'entrepreneurship', 'finance', 'accounting', 'excel', 'startup'],
    'IT & Software': ['it', 'software', 'comptia', 'linux', 'git', 'database', 'sql', 'oracle', 'networking', 'java', 'c++', 'c#'],
    'Photography & Video': ['photography', 'photo', 'camera', 'video', 'video editing', 'premiere', 'after effects', 'filmora', 'davinci'],
    'Personal Development': ['personal development', 'productivity', 'communication', 'leadership', 'motivation', 'mindset', 'life coaching'],
    'Music': ['music', 'guitar', 'piano', 'drums', 'singing', 'audio', 'music production', 'ableton'],
    'Language': ['language', 'english', 'spanish', 'french', 'german', 'japanese', 'chinese', 'arabic'],
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(k => text.includes(k))) {
      return category;
    }
  }
  return 'Other';
}

function extractCouponCode(url: string): string {
  try {
    const urlObj = new URL(url);
    const couponParam = urlObj.searchParams.get('couponCode') || urlObj.searchParams.get('coupon') || urlObj.searchParams.get('code');
    if (couponParam) return couponParam;
  } catch {
    // ignore
  }
  return '';
}

function extractUdemyUrl(couponUrl: string): string {
  try {
    const urlObj = new URL(couponUrl);
    // coupon URLs usually look like: https://www.udemy.com/course/course-name/?couponCode=XXX
    // Extract the base Udemy URL
    const pathname = urlObj.pathname;
    // Remove trailing slash and query
    const coursePath = pathname.replace(/\/$/, '');
    // Check if it's a Udemy course URL
    if (coursePath.includes('/course/')) {
      return `https://www.udemy.com${coursePath}`;
    }
  } catch {
    // ignore
  }
  return couponUrl;
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
// UdemyFreebies Scraper
// ============================================

async function scrapeUdemyFreebies(maxPages: number = 5): Promise<SourceResult> {
  const start = Date.now();
  let newCount = 0;
  let dupCount = 0;
  let errCount = 0;
  const allCourses: ScrapedCourseData[] = [];
  const errors: string[] = [];

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  };

  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = page === 1
        ? 'https://www.udemyfreebies.com/free-udemy-courses/'
        : `https://www.udemyfreebies.com/free-udemy-courses/page/${page}/`;

      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(20000),
      });

      if (!response.ok) {
        if (response.status === 404) break;
        errors.push(`Page ${page}: HTTP ${response.status}`);
        errCount++;
        continue;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract course cards - UdemyFreebies uses article/post structures
      const courseCards: ScrapedCourseData[] = [];

      // Try multiple selectors to find course entries
      const entries = $('article, .post, .entry, .elementor-widget-container');

      entries.each((_, el) => {
        const $el = $(el);

        // Find title - try multiple selectors
        let title = '';
        let courseLink = '';
        const titleEl = $el.find('h2 a, h3 a, h4 a, .entry-title a, .post-title a');
        if (titleEl.length > 0) {
          title = titleEl.first().text().trim();
          courseLink = titleEl.first().attr('href') || '';
        }

        if (!title || title.length < 5) {
          // Try to find any link to udemy
          const udemyLinks = $el.find('a[href*="udemy.com"]');
          if (udemyLinks.length > 0) {
            courseLink = udemyLinks.first().attr('href') || '';
            title = udemyLinks.first().text().trim() || udemyLinks.first().attr('title') || '';
          }
        }

        if (!title || title.length < 10) return;

        // Find image
        let imageUrl = '';
        const imgEl = $el.find('img');
        if (imgEl.length > 0) {
          imageUrl = imgEl.first().attr('src') || imgEl.first().attr('data-lazy-src') || imgEl.first().attr('data-src') || '';
        }

        // Find description
        let description = '';
        const descEl = $el.find('.entry-content, .entry-summary, .post-content, .elementor-widget-theme-post-content, p');
        if (descEl.length > 0) {
          description = descEl.first().text().trim().slice(0, 500);
        }

        // Find instructor
        let instructor = '';
        const instrEl = $el.find('.instructor, .author, .byline, .posted-by');
        if (instrEl.length > 0) {
          instructor = instrEl.first().text().trim();
        }

        // Find rating
        let rating: number | null = null;
        const ratingEl = $el.find('.rating, .stars, [class*="rating"]');
        if (ratingEl.length > 0) {
          const ratingText = ratingEl.first().text().trim();
          const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
          if (ratingMatch) rating = parseFloat(ratingMatch[1]);
        }

        // Find price
        let originalPrice: string | null = null;
        const priceEl = $el.find('.price, .original-price, [class*="price"]');
        if (priceEl.length > 0) {
          const priceText = priceEl.first().text().trim();
          const priceMatch = priceText.match(/\$[\d,.]+/);
          if (priceMatch) originalPrice = priceMatch[0];
        }

        // Determine Udemy URL and coupon
        let udemyUrl = courseLink;
        let couponUrl = '';
        let couponCode = '';

        // Check for coupon URL in the entry
        const couponLinks = $el.find('a[href*="coupon"], a[href*="code"], .btn-coupon a, .coupon-button a');
        if (couponLinks.length > 0) {
          couponUrl = couponLinks.first().attr('href') || '';
          couponCode = extractCouponCode(couponUrl);
          if (couponUrl) {
            udemyUrl = extractUdemyUrl(couponUrl);
          }
        }

        // If course link is a udemy URL, use it directly
        if (courseLink.includes('udemy.com') && !couponUrl) {
          udemyUrl = courseLink;
          couponUrl = courseLink;
          couponCode = extractCouponCode(courseLink);
        }

        // If we still don't have a udemy URL, skip
        if (!udemyUrl || !udemyUrl.includes('udemy.com')) {
          // Try to find any udemy link in the element
          const anyUdemyLink = $el.find('a[href*="udemy.com"]').first();
          if (anyUdemyLink.length > 0) {
            udemyUrl = anyUdemyLink.attr('href') || '';
            couponUrl = udemyUrl;
            couponCode = extractCouponCode(udemyUrl);
          } else {
            return; // Skip this entry - no udemy URL found
          }
        }

        // Extract language and duration from description if possible
        let language: string | null = null;
        let duration: string | null = null;
        const fullText = $el.text();

        const langMatch = fullText.match(/language[:\s]+(\w+)/i) || fullText.match(/(\w+)\s+language/i);
        if (langMatch) language = langMatch[1].charAt(0).toUpperCase() + langMatch[1].slice(1).toLowerCase();

        const durMatch = fullText.match(/(\d+\.?\d*)\s*hours?/i) || fullText.match(/(\d+)\s*h(?:ours?)?/i);
        if (durMatch) duration = `${durMatch[1]} hours`;

        // Find students count
        let studentsCount: number | null = null;
        const studentsMatch = fullText.match(/([\d,]+)\s*students?/i);
        if (studentsMatch) studentsCount = parseInt(studentsMatch[1].replace(/,/g, ''));

        courseCards.push({
          title,
          description,
          instructor,
          category: categorize(title, description),
          imageUrl: imageUrl || '',
          udemyUrl,
          couponUrl,
          couponCode,
          rating,
          studentsCount,
          originalPrice,
          language,
          duration,
          source: 'udemyfreebies',
        });
      });

      // Process courses - check for duplicates and insert
      for (const course of courseCards) {
        try {
          const result = await createCourseIfNotExists({
            title: course.title,
            slug: slugify(course.title),
            description: course.description,
            instructor: course.instructor,
            category: course.category,
            imageUrl: course.imageUrl,
            udemyUrl: course.udemyUrl,
            source: course.source,
            rating: course.rating,
            studentsCount: course.studentsCount,
            originalPrice: course.originalPrice,
            language: course.language,
            duration: course.duration,
            couponCode: course.couponCode,
            couponUrl: course.couponUrl,
          });
          if (result.created) {
            newCount++;
            allCourses.push(course);
          } else {
            dupCount++;
          }
        } catch (err) {
          errCount++;
          errors.push(`"${course.title}": ${err}`);
        }
      }

      // Stop if no courses found on this page
      if (courseCards.length === 0 && page > 1) break;

    } catch (err) {
      errors.push(`Page ${page}: ${err}`);
      errCount++;
    }
  }

  const duration = Date.now() - start;
  const status = errCount > 0 && newCount === 0 ? 'error' : errCount > 0 ? 'partial' : 'success';

  // Log the scraper run
  const logEntry: ScraperLogEntry = {
    source: 'udemyfreebies',
    status,
    newCount,
    dupCount,
    errCount,
    message: errors.slice(0, 5).join('; '),
    duration,
  };
  await logScraperRun(logEntry).catch(() => {});

  return {
    source: 'udemyfreebies',
    status,
    newCount,
    dupCount,
    errCount,
    message: `Found ${newCount + dupCount} courses (${newCount} new, ${dupCount} duplicates, ${errCount} errors)`,
    duration,
    courses: allCourses,
  };
}

// ============================================
// StudyBullet Scraper
// ============================================

async function scrapeStudyBullet(maxPages: number = 3): Promise<SourceResult> {
  const start = Date.now();
  let newCount = 0;
  let dupCount = 0;
  let errCount = 0;
  const allCourses: ScrapedCourseData[] = [];
  const errors: string[] = [];

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  };

  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = page === 1
        ? 'https://studybullet.com/category/free-courses/'
        : `https://studybullet.com/category/free-courses/page/${page}/`;

      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(20000),
      });

      if (!response.ok) {
        if (response.status === 404) break;
        errors.push(`Page ${page}: HTTP ${response.status}`);
        errCount++;
        continue;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const courseCards: ScrapedCourseData[] = [];

      // StudyBullet uses WordPress article structure
      const entries = $('article, .post, .entry');

      entries.each((_, el) => {
        const $el = $(el);

        // Find title
        let title = '';
        let courseLink = '';
        const titleEl = $el.find('h2 a, h3 a, .entry-title a');
        if (titleEl.length > 0) {
          title = titleEl.first().text().trim();
          courseLink = titleEl.first().attr('href') || '';
        }

        if (!title || title.length < 10) return;

        // Find image
        let imageUrl = '';
        const imgEl = $el.find('img');
        if (imgEl.length > 0) {
          imageUrl = imgEl.first().attr('src') || imgEl.first().attr('data-lazy-src') || imgEl.first().attr('data-src') || '';
        }

        // Find description
        let description = '';
        const descEl = $el.find('.entry-content, .entry-summary, .post-content, p');
        if (descEl.length > 0) {
          description = descEl.first().text().trim().slice(0, 500);
        }

        // Find instructor
        let instructor = '';
        const instrEl = $el.find('.instructor, .author, .byline, .posted-by');
        if (instrEl.length > 0) {
          instructor = instrEl.first().text().trim();
        }

        // Find rating
        let rating: number | null = null;
        const ratingEl = $el.find('.rating, .stars, [class*="rating"]');
        if (ratingEl.length > 0) {
          const ratingText = ratingEl.first().text().trim();
          const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
          if (ratingMatch) rating = parseFloat(ratingMatch[1]);
        }

        // Find price
        let originalPrice: string | null = null;
        const priceEl = $el.find('.price, .original-price, [class*="price"]');
        if (priceEl.length > 0) {
          const priceText = priceEl.first().text().trim();
          const priceMatch = priceText.match(/\$[\d,.]+/);
          if (priceMatch) originalPrice = priceMatch[0];
        }

        // Find Udemy URL from links in the entry
        let udemyUrl = '';
        let couponUrl = '';
        let couponCode = '';

        // First, check if there's a coupon/udemy link
        const udemyLinks = $el.find('a[href*="udemy.com"]');
        if (udemyLinks.length > 0) {
          const firstUdemyLink = udemyLinks.first().attr('href') || '';
          couponUrl = firstUdemyLink;
          couponCode = extractCouponCode(firstUdemyLink);
          udemyUrl = extractUdemyUrl(firstUdemyLink);
        }

        // If no udemy link found, use the course link as is
        if (!udemyUrl && courseLink) {
          udemyUrl = courseLink;
          couponUrl = courseLink;
          couponCode = extractCouponCode(courseLink);
        }

        // If we still don't have a valid URL, skip
        if (!udemyUrl) return;

        // Extract language and duration from text
        let language: string | null = null;
        let duration: string | null = null;
        const fullText = $el.text();

        const langMatch = fullText.match(/language[:\s]+(\w+)/i) || fullText.match(/(\w+)\s+language/i);
        if (langMatch) language = langMatch[1].charAt(0).toUpperCase() + langMatch[1].slice(1).toLowerCase();

        const durMatch = fullText.match(/(\d+\.?\d*)\s*hours?/i) || fullText.match(/(\d+)\s*h(?:ours?)?/i);
        if (durMatch) duration = `${durMatch[1]} hours`;

        let studentsCount: number | null = null;
        const studentsMatch = fullText.match(/([\d,]+)\s*students?/i);
        if (studentsMatch) studentsCount = parseInt(studentsMatch[1].replace(/,/g, ''));

        courseCards.push({
          title,
          description,
          instructor,
          category: categorize(title, description),
          imageUrl: imageUrl || '',
          udemyUrl,
          couponUrl,
          couponCode,
          rating,
          studentsCount,
          originalPrice,
          language,
          duration,
          source: 'studybullet',
        });
      });

      // Process courses
      for (const course of courseCards) {
        try {
          const result = await createCourseIfNotExists({
            title: course.title,
            slug: slugify(course.title),
            description: course.description,
            instructor: course.instructor,
            category: course.category,
            imageUrl: course.imageUrl,
            udemyUrl: course.udemyUrl,
            source: course.source,
            rating: course.rating,
            studentsCount: course.studentsCount,
            originalPrice: course.originalPrice,
            language: course.language,
            duration: course.duration,
            couponCode: course.couponCode,
            couponUrl: course.couponUrl,
          });
          if (result.created) {
            newCount++;
            allCourses.push(course);
          } else {
            dupCount++;
          }
        } catch (err) {
          errCount++;
          errors.push(`"${course.title}": ${err}`);
        }
      }

      if (courseCards.length === 0 && page > 1) break;

    } catch (err) {
      errors.push(`Page ${page}: ${err}`);
      errCount++;
    }
  }

  const duration = Date.now() - start;
  const status = errCount > 0 && newCount === 0 ? 'error' : errCount > 0 ? 'partial' : 'success';

  const logEntry: ScraperLogEntry = {
    source: 'studybullet',
    status,
    newCount,
    dupCount,
    errCount,
    message: errors.slice(0, 5).join('; '),
    duration,
  };
  await logScraperRun(logEntry).catch(() => {});

  return {
    source: 'studybullet',
    status,
    newCount,
    dupCount,
    errCount,
    message: `Found ${newCount + dupCount} courses (${newCount} new, ${dupCount} duplicates, ${errCount} errors)`,
    duration,
    courses: allCourses,
  };
}

// ============================================
// Main Entry Point - Parallel Scraper
// ============================================

export interface ScrapeResults {
  udemyfreebies: SourceResult;
  studybullet: SourceResult;
  totalNew: number;
  totalDup: number;
  totalErr: number;
  totalDuration: number;
}

export async function runFullScrape(sources?: string[]): Promise<ScrapeResults> {
  const totalStart = Date.now();

  // Determine which sources to scrape
  const runUdemy = !sources || sources.includes('all') || sources.includes('udemyfreebies');
  const runStudy = !sources || sources.includes('all') || sources.includes('studybullet');

  const emptyResult = (source: string): SourceResult => ({
    source,
    status: 'success',
    newCount: 0,
    dupCount: 0,
    errCount: 0,
    message: 'Skipped',
    duration: 0,
    courses: [],
  });

  // Run both scrapers IN PARALLEL using Promise.allSettled
  const [udemyResult, studyResult] = await Promise.allSettled([
    runUdemy ? scrapeUdemyFreebies(5) : Promise.resolve(emptyResult('udemyfreebies')),
    runStudy ? scrapeStudyBullet(3) : Promise.resolve(emptyResult('studybullet')),
  ]);

  const udemy = udemyResult.status === 'fulfilled'
    ? udemyResult.value
    : { ...emptyResult('udemyfreebies'), status: 'error' as const, message: String(udemyResult.reason), errCount: 1 };

  const study = studyResult.status === 'fulfilled'
    ? studyResult.value
    : { ...emptyResult('studybullet'), status: 'error' as const, message: String(studyResult.reason), errCount: 1 };

  const totalDuration = Date.now() - totalStart;

  return {
    udemyfreebies: udemy,
    studybullet: study,
    totalNew: udemy.newCount + study.newCount,
    totalDup: udemy.dupCount + study.dupCount,
    totalErr: udemy.errCount + study.errCount,
    totalDuration,
  };
}

// Individual scrapers can also be exported for targeted runs
export { scrapeUdemyFreebies, scrapeStudyBullet };
