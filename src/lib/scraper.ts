import * as cheerio from 'cheerio';
import { db } from '@/lib/db';
import { logScraperRun, createCourseIfNotExists, upsertCourseCoupon, type ScraperLogEntry } from './mongodb';

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

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function normalizeUdemyUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove couponCode from URL for dedup comparison
    urlObj.searchParams.delete('couponCode');
    urlObj.searchParams.delete('coupon');
    return urlObj.toString().replace(/\?$/, '');
  } catch {
    return url;
  }
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
// Coupon Validation & Expiry Estimation
// ============================================

/**
 * Check if a coupon code is a real, valid-looking Udemy coupon.
 * Rejects fake/placeholder codes like 'DIRECT', 'FREE', empty strings.
 */
function isValidCouponCode(couponCode: string): boolean {
  if (!couponCode) return false;
  if (couponCode === 'DIRECT' || couponCode === 'FREE') return false;
  if (couponCode.length < 4) return false;
  // Must be alphanumeric or contain real coupon characters
  return /^[A-Za-z0-9_\-]+$/.test(couponCode);
}

/**
 * Check if a coupon code contains a month/year pattern (e.g. JUL2025, JUN2025FREE)
 * These are typically fresher coupons that should always be verified.
 */
function couponHasMonthYear(couponCode: string): boolean {
  const monthPattern = /(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{2,4})/i;
  return monthPattern.test(couponCode);
}

/**
 * Detect if a course is genuinely free forever on Udemy.
 * CRITICAL: This should almost NEVER return true.
 * Only courses that are free on Udemy without ANY coupon should be marked as free forever.
 * We can't easily verify this, so we only trust specific patterns.
 */
function detectFreeForever(couponCode: string): boolean {
  // Courses with no coupon code are NOT free - they are paid!
  // Only mark as free forever if we have strong evidence.
  // For now, we NEVER auto-detect free forever.
  return false;
}

/**
 * Estimate coupon expiry based on coupon code patterns.
 * ALL Udemy coupons are time-limited. Returns estimated expiry.
 */
function estimateCouponExpiry(couponCode: string): Date | null {
  if (!couponCode || !isValidCouponCode(couponCode)) return null;

  // Parse month/year patterns like JUN2026FREE1, MAY2026FRE01
  const monthNames: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  };
  const monthMatch = couponCode.match(/(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{2,4})/i);
  if (monthMatch) {
    const month = monthNames[monthMatch[1].toUpperCase()];
    if (month !== undefined) {
      const yearStr = monthMatch[2];
      const year = yearStr.length === 2 ? 2000 + parseInt(yearStr) : parseInt(yearStr);
      if (year >= 2024 && year <= 2030) {
        return new Date(year, month + 1, 0, 23, 59, 59);
      }
    }
  }

  // Standard hex/alpha coupon codes: estimate 2-5 days
  // These are the most common Udemy coupon formats
  if (/^[A-Z0-9]{8,}$/.test(couponCode)) {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 3); // Conservative estimate: 3 days
    expiry.setHours(23, 59, 59, 0);
    return expiry;
  }

  // Shorter coupon codes: 1-2 days
  if (couponCode.length >= 4 && couponCode.length < 8) {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 2);
    expiry.setHours(23, 59, 59, 0);
    return expiry;
  }

  // Default: 3 days for any valid coupon
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 3);
  expiry.setHours(23, 59, 59, 0);
  return expiry;
}

// ============================================
// Udemy Coupon Verification (Improved)
// ============================================

// Rate-limit tracking
let lastUdemyRequestTime = 0;
let rateLimitBackoffUntil = 0;

/**
 * Wait if we're rate-limited or need to throttle requests.
 * Returns true if we should skip this request (still in backoff).
 */
async function waitForRateLimit(): Promise<boolean> {
  if (rateLimitBackoffUntil > Date.now()) {
    const waitMs = rateLimitBackoffUntil - Date.now();
    console.log(`[Scraper] Rate limited, backing off for ${Math.ceil(waitMs / 1000)}s...`);
    await new Promise(r => setTimeout(r, waitMs));
    rateLimitBackoffUntil = 0;
    return false;
  }

  // Minimum 1.5s between Udemy requests
  const now = Date.now();
  const elapsed = now - lastUdemyRequestTime;
  if (elapsed < 1500) {
    await new Promise(r => setTimeout(r, 1500 - elapsed));
  }
  lastUdemyRequestTime = Date.now();
  return false;
}

/**
 * Verify if a Udemy coupon is still active by checking the course page.
 * Improved: Checks JSON data blocks in <script> tags for pricing data,
 * since Udemy embeds pricing info in __NEXT_DATA__ or __APOLLO_STATE__.
 */
async function verifyCouponOnUdemy(couponUrl: string): Promise<{ isFree: boolean; verified: boolean }> {
  try {
    const shouldSkip = await waitForRateLimit();
    if (shouldSkip) return { isFree: false, verified: false };

    const response = await fetch(couponUrl, {
      headers: getRandomHeaders(),
      signal: AbortSignal.timeout(20000),
      redirect: 'follow',
    });

    // Handle rate limiting (429)
    if (response.status === 429) {
      console.log(`[Scraper] Udemy returned 429 - rate limited. Backing off for 5s...`);
      rateLimitBackoffUntil = Date.now() + 5000;
      return { isFree: false, verified: false };
    }

    if (!response.ok) return { isFree: false, verified: false };

    const html = await response.text();
    const htmlLower = html.toLowerCase();

    // --- STRATEGY 1: Check JSON data blocks in <script> tags ---
    // Udemy embeds pricing data in __NEXT_DATA__ or __APOLLO_STATE__
    const scriptBlocks = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];

    for (const block of scriptBlocks) {
      const blockLower = block.toLowerCase();

      // Check __NEXT_DATA__ for pricing info
      if (block.includes('__NEXT_DATA__') || block.includes('__NEXT_DATA__')) {
        // Look for isFree, price patterns in JSON
        const jsonPatterns = [
          { pattern: /"isFree"\s*:\s*true/i, free: true },
          { pattern: /"purchase_price"\s*:\s*\{[^}]*"amount"\s*:\s*0/i, free: true },
          { pattern: /"price"\s*:\s*0[^.]/i, free: true },
          { pattern: /"price_amount"\s*:\s*0/i, free: true },
          { pattern: /"current_price"\s*:\s*"?0"/i, free: true },
          { pattern: /"discount_price"\s*:\s*\{[^}]*"amount"\s*:\s*0/i, free: true },
          { pattern: /"list_price"\s*:\s*\{[^}]*"amount"\s*:\s*0/i, free: true },
          { pattern: /"price\s*>\s*0/i, free: false },
          { pattern: /"purchase_price"\s*:\s*\{[^}]*"amount"\s*:\s*[1-9]/i, free: false },
          { pattern: /"price_amount"\s*:\s*[1-9]/i, free: false },
          { pattern: /"current_price"\s*:\s*"[1-9]/i, free: false },
        ];

        for (const { pattern, free } of jsonPatterns) {
          if (pattern.test(block)) {
            return { isFree: free, verified: true };
          }
        }
      }

      // Check __APOLLO_STATE__ for pricing
      if (block.includes('__APOLLO_STATE__')) {
        // Apollo state often has pricing data in JSON
        try {
          // Try to extract JSON-like content
          const apolloMatch = block.match(/__APOLLO_STATE__\s*=\s*({[\s\S]*?})\s*;?\s*$/m);
          if (apolloMatch) {
            const apolloContent = apolloMatch[1];
            const apolloLower = apolloContent.toLowerCase();

            // Check for free pricing in Apollo state
            if (
              apolloLower.includes('"isfree":true') ||
              apolloLower.includes('"is_free":true') ||
              /"price"\s*:\s*0[^.]/.test(apolloLower) ||
              /"currentprice"\s*:\s*"?0"/i.test(apolloLower)
            ) {
              return { isFree: true, verified: true };
            }

            // Check for paid pricing in Apollo state
            if (
              /"currentprice"\s*:\s*"[1-9]/i.test(apolloLower) ||
              /"price"\s*:\s*[1-9]/.test(apolloLower)
            ) {
              return { isFree: false, verified: true };
            }
          }
        } catch {
          // JSON parse failed, continue
        }
      }

      // Generic: look for any script block with Udemy pricing JSON
      if (block.includes('udemy') || block.includes('course') || block.includes('pricing')) {
        const jsonPatterns = [
          { pattern: /"is_free"\s*:\s*true/i, free: true },
          { pattern: /"purchase_price"\s*:\s*\{[^}]*"amount"\s*:\s*0/i, free: true },
          { pattern: /"price_amount"\s*:\s*0/i, free: true },
        ];
        for (const { pattern, free } of jsonPatterns) {
          if (pattern.test(block)) {
            return { isFree: free, verified: true };
          }
        }
      }
    }

    // --- STRATEGY 2: HTML indicators (fallback) ---
    // Check for indicators that the course is free with this coupon
    const freeIndicators = [
      'enroll for free',
      'free course',
      '$0',
      'price_free',
      '"is_free":true',
      '"price":0',
      '"price_amount":0',
      'data-purpose="enroll-free"',
    ];

    // Check for indicators that the coupon is expired / course is paid
    const paidIndicators = [
      'buy now',
      'add to cart',
      'data-purpose="buy',
    ];

    let freeScore = 0;
    let paidScore = 0;

    for (const indicator of freeIndicators) {
      if (htmlLower.includes(indicator)) freeScore++;
    }
    for (const indicator of paidIndicators) {
      if (htmlLower.includes(indicator)) paidScore++;
    }

    // If we found clear free indicators, the coupon is valid
    if (freeScore >= 2) return { isFree: true, verified: true };
    if (freeScore >= 1 && paidScore === 0) return { isFree: true, verified: true };

    // If we found clear paid indicators and NO free indicators
    if (paidScore >= 2 && freeScore === 0) return { isFree: false, verified: true };

    // Can't determine - assume not verified
    return { isFree: false, verified: false };
  } catch {
    return { isFree: false, verified: false };
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
  pageIndex?: number; // Track which page this came from (for verification sampling)
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
  couponExpiresAt: Date | null;
  isFreeForever: boolean;
  couponVerified: boolean;
  sourceDetail: string;
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
  expiredCount: number;
  updatedCount: number;
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
// Verification Sampling Logic
// ============================================

/**
 * Determine if a course should be verified based on its page position and coupon code.
 * - Pages 1-3: verify every course (most likely fresh)
 * - Pages 4+: sample 30% of courses
 * - If coupon has month/year pattern (e.g. JUL2025): always verify
 */
function shouldVerifyCoupon(pageIndex: number, couponCode: string): boolean {
  // Pages 0-2 (1-3): always verify
  if (pageIndex < 3) return true;
  // Month/year coupons: always verify
  if (couponHasMonthYear(couponCode)) return true;
  // Pages 4+: 30% sampling
  return Math.random() < 0.3;
}

// ============================================
// UdemyFreebies Scraper
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
      pageIndex: pageNum - 1, // 0-indexed
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

async function extractUdemyUrl(detailUrl: string): Promise<{ udemyUrl: string; couponCode: string } | null> {
  try {
    const slugMatch = detailUrl.match(/free-udemy-course\/(.+?)$/);
    if (!slugMatch) return null;

    const outUrl = `https://www.udemyfreebies.com/out/${slugMatch[1]}`;

    // Try manual redirect first to capture the Location header
    const response = await fetch(outUrl, {
      headers: getRandomHeaders(),
      signal: AbortSignal.timeout(10000),
      redirect: 'manual',
    });

    const location = response.headers.get('location');
    if (location && location.includes('udemy.com')) {
      const couponCode = extractCouponCode(location);
      if (couponCode && isValidCouponCode(couponCode)) {
        return { udemyUrl: location, couponCode };
      }
      if (location.includes('couponCode=')) {
        try {
          const urlObj = new URL(location);
          const code = urlObj.searchParams.get('couponCode') || urlObj.searchParams.get('coupon');
          if (code && isValidCouponCode(code)) {
            return { udemyUrl: location, couponCode: code };
          }
        } catch { /* invalid URL */ }
      }
      console.log(`[Scraper] Skipping "${detailUrl}" - no valid coupon code in redirect URL`);
      return null;
    }

    // Fallback: follow redirects and check final URL
    const followResp = await fetch(outUrl, {
      headers: getRandomHeaders(),
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });
    const finalUrl = followResp.url;
    if (finalUrl && finalUrl.includes('udemy.com')) {
      const couponCode = extractCouponCode(finalUrl);
      if (couponCode && isValidCouponCode(couponCode)) {
        return { udemyUrl: finalUrl, couponCode };
      }
      console.log(`[Scraper] Skipping "${detailUrl}" - no valid coupon in followed URL`);
      return null;
    }

    return null;
  } catch {
    return null;
  }
}

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
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });

    if (!response.ok) return empty;

    const html = await response.text();
    const $ = cheerio.load(html);

    let description = '';
    const $desc = $('h2, h3').filter(function() {
      return $(this).text().trim().toLowerCase() === 'description';
    });
    if ($desc.length > 0) {
      const $next = $desc.next();
      if ($next.length > 0) {
        description = $next.text().trim();
        description = description.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
        description = description.replace(/\s+/g, ' ').trim();
      }
    }

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

    let duration: string | null = null;
    let lastUpdated: string | null = null;

    if (description) {
      const durMatch = description.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr)\b/i);
      if (durMatch) {
        duration = `${durMatch[1]} hours`;
      } else {
        const minMatch = description.match(/(\d+)\s*(?:minutes?|mins?|min)\b/i);
        if (minMatch) {
          duration = `${minMatch[1]} min`;
        }
      }

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

async function processCourse(
  course: ListingCourse,
  existingUrls: Set<string>,
  existingTitles: Set<string>
): Promise<{ saved: boolean; updated?: boolean; skipped?: string; data?: ScrapedCourseData }> {
  try {
    const normTitle = normalizeTitle(course.title);
    if (existingTitles.has(normTitle)) {
      return { saved: false, skipped: 'duplicate-title' };
    }

    const result = await extractUdemyUrl(course.detailUrl);
    if (!result) return { saved: false, skipped: 'no-valid-coupon' };

    const { udemyUrl, couponCode } = result;
    if (!isValidCouponCode(couponCode)) {
      return { saved: false, skipped: 'no-valid-coupon' };
    }

    const normalizedUrl = normalizeUdemyUrl(udemyUrl);
    const couponUrl = udemyUrl; // Full URL with couponCode param

    // --- DEDUP UPDATE: If existing course found, update its coupon ---
    if (existingUrls.has(normalizedUrl)) {
      // Try to update the existing course with the new coupon
      const couponExpiry = estimateCouponExpiry(couponCode);
      const upsertResult = await upsertCourseCoupon(normalizedUrl, {
        couponCode,
        couponUrl,
        couponExpiresAt: couponExpiry,
        couponVerified: false, // Will be verified below if sampling says so
      });

      if (upsertResult.updated) {
        console.log(`[Scraper] Updated coupon for existing course: "${course.title.substring(0, 40)}" → ${couponCode}`);

        // Optionally verify the updated coupon
        const pageIndex = course.pageIndex ?? 99;
        if (shouldVerifyCoupon(pageIndex, couponCode)) {
          const verifyResult = await verifyCouponOnUdemy(couponUrl);
          if (verifyResult.verified) {
            // Update verified status
            await upsertCourseCoupon(normalizedUrl, {
              couponCode,
              couponUrl,
              couponExpiresAt: couponExpiry,
              couponVerified: verifyResult.isFree,
            });
          }
        }

        return { saved: false, updated: true };
      }

      return { saved: false, skipped: 'duplicate-url' };
    }

    // --- NEW COURSE: Verify coupon based on sampling ---
    const detailPromise = scrapeDetailPage(course.detailUrl);
    const couponExpiry = estimateCouponExpiry(couponCode);

    // Determine if we should verify
    const pageIndex = course.pageIndex ?? 99;
    const doVerify = shouldVerifyCoupon(pageIndex, couponCode);

    let couponVerified = false;

    if (doVerify) {
      console.log(`[Scraper] Verifying coupon for "${course.title.substring(0, 40)}" (page ${pageIndex + 1})...`);
      const verifyResult = await verifyCouponOnUdemy(couponUrl);

      if (verifyResult.verified) {
        couponVerified = verifyResult.isFree;
        if (!verifyResult.isFree) {
          // Coupon verified as expired/paid - skip this course
          console.log(`[Scraper] Coupon verified as NOT FREE for "${course.title.substring(0, 40)}" - skipping`);
          return { saved: false, skipped: 'expired-coupon' };
        }
        console.log(`[Scraper] Coupon verified as FREE for "${course.title.substring(0, 40)}" ✓`);
      } else {
        // Verification inconclusive - store without verified flag
        console.log(`[Scraper] Coupon verification inconclusive for "${course.title.substring(0, 40)}" - storing unverified`);
      }
    }

    const courseData: ScrapedCourseData = {
      title: course.title,
      description: '',
      instructor: course.instructor,
      category: course.category,
      imageUrl: course.imageUrl,
      udemyUrl,
      couponUrl,
      couponCode,
      couponExpiresAt: couponExpiry,
      isFreeForever: false,
      couponVerified,
      sourceDetail: 'udemyfreebies',
      rating: course.rating,
      studentsCount: course.studentsCount,
      originalPrice: course.originalPrice ? `$${course.originalPrice.toFixed(2)}` : null,
      language: course.language || null,
      duration: null,
      requirements: '',
      whoFor: '',
      whatLearn: '',
      lastUpdated: null,
      source: 'udemyfreebies',
    };

    try {
      const detailData = await detailPromise;
      if (detailData.description) {
        courseData.description = detailData.description;
      } else {
        courseData.description = `تعلم ${course.title} مع هذه الدورة المجانية الشاملة. تشمل مهارات ${course.category} والتطبيقات العملية في العالم الحقيقي.`;
      }
      courseData.requirements = detailData.requirements;
      courseData.whoFor = detailData.whoFor;
      courseData.duration = detailData.duration;
      courseData.lastUpdated = detailData.lastUpdated;
    } catch {
      courseData.description = `تعلم ${course.title} مع هذه الدورة المجانية الشاملة. تشمل مهارات ${course.category} والتطبيقات العملية في العالم الحقيقي.`;
    }

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
      couponExpiresAt: courseData.couponExpiresAt,
      isFreeForever: courseData.isFreeForever,
      sourceDetail: courseData.sourceDetail,
      couponVerified: courseData.couponVerified,
    });

    if (dbResult.created) {
      existingUrls.add(normalizedUrl);
      existingTitles.add(normTitle);
      return { saved: true, data: courseData };
    }

    return { saved: false, skipped: 'db-duplicate' };
  } catch (err) {
    console.error(`[Scraper] Error processing "${course.title.substring(0, 40)}":`, err);
    return { saved: false, skipped: 'error' };
  }
}

async function scrapeUdemyFreebies(maxPages: number = 20): Promise<SourceResult> {
  const start = Date.now();
  let newCount = 0;
  let dupCount = 0;
  let errCount = 0;
  let expiredCount = 0;
  let updatedCount = 0;
  const allCourses: ScrapedCourseData[] = [];
  const errors: string[] = [];

  try {
    const existingCourses = await db.course.findMany({
      select: { udemyUrl: true, title: true },
    });
    const existingUrls = new Set(existingCourses.map(c => normalizeUdemyUrl(c.udemyUrl)));
    const existingTitles = new Set(existingCourses.map(c => normalizeTitle(c.title)));
    console.log(`[Scraper/UdemyFreebies] Starting with ${existingCourses.length} existing courses in DB`);

    console.log(`[Scraper/UdemyFreebies] Fetching ${maxPages} pages in parallel...`);
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

    console.log(`[Scraper/UdemyFreebies] Found ${allListedCourses.length} course listings from ${maxPages} pages`);

    // Use batch size of 5 for verification (reduced from 10)
    const BATCH_SIZE = 5;
    for (let i = 0; i < allListedCourses.length; i += BATCH_SIZE) {
      const batch = allListedCourses.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(allListedCourses.length / BATCH_SIZE);

      // Process sequentially when verification is needed (to respect rate limits)
      const batchResults: PromiseSettledResult<{ saved: boolean; updated?: boolean; skipped?: string; data?: ScrapedCourseData }>[] = [];

      // Check if any course in this batch needs verification
      const needsVerification = batch.some(c => shouldVerifyCoupon(c.pageIndex ?? 99, extractCouponCodeFromContext(c)));

      if (needsVerification) {
        // Sequential processing to respect rate limits
        for (const course of batch) {
          const result = await processCourse(course, existingUrls, existingTitles);
          batchResults.push({ status: 'fulfilled', value: result });
        }
      } else {
        // Parallel processing when no verification needed
        const results = await Promise.allSettled(
          batch.map(course => processCourse(course, existingUrls, existingTitles))
        );
        batchResults.push(...results);
      }

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          if (result.value.saved) {
            newCount++;
            allCourses.push(result.value.data!);
          } else if (result.value.updated) {
            updatedCount++;
          } else if (result.value.skipped === 'duplicate-title' || result.value.skipped === 'duplicate-url' || result.value.skipped === 'db-duplicate') {
            dupCount++;
          } else if (result.value.skipped === 'no-valid-coupon' || result.value.skipped === 'expired-coupon') {
            expiredCount++;
          } else {
            errCount++;
          }
        } else {
          errCount++;
        }
      }

      if (i + BATCH_SIZE < allListedCourses.length) {
        console.log(`[Scraper/UdemyFreebies] Batch ${batchNum}/${totalBatches}: ${newCount} new, ${updatedCount} updated, ${dupCount} dup, ${expiredCount} no-coupon/expired, ${errCount} err`);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

  } catch (err) {
    errors.push(`Fatal: ${err}`);
    errCount++;
  }

  const duration = Date.now() - start;
  const status = newCount > 0 ? 'success' : (errCount > 0 ? 'error' : 'partial');

  console.log(`[Scraper/UdemyFreebies] Done in ${(duration / 1000).toFixed(1)}s: ${newCount} new, ${updatedCount} updated, ${dupCount} dup, ${expiredCount} no-coupon/expired, ${errCount} err`);

  const logEntry: ScraperLogEntry = {
    source: 'udemyfreebies',
    status,
    newCount,
    dupCount,
    errCount,
    message: `${newCount} new, ${updatedCount} updated from ${maxPages} pages, ${dupCount} dup, ${expiredCount} no-valid-coupon, ${errCount} err`,
    duration,
  };
  await logScraperRun(logEntry).catch(() => {});

  return {
    source: 'udemyfreebies',
    status,
    newCount,
    dupCount,
    errCount,
    expiredCount,
    updatedCount,
    message: `${maxPages} صفحة → ${newCount} جديدة، ${updatedCount} محدثة، ${dupCount} مكررة، ${expiredCount} بدون كوبون صالح، ${errCount} أخطاء`,
    duration,
    courses: allCourses,
  };
}

/**
 * Helper to extract a rough coupon code guess from listing context (for shouldVerifyCoupon)
 */
function extractCouponCodeFromContext(course: ListingCourse): string {
  return ''; // We don't have the coupon yet at listing stage; default to no-verify for 30% sampling
}

// ============================================
// DiscUdemy Scraper
// Fetches course listings from discudemy.com, gets Udemy URLs from couponami.com/go/
// ============================================

async function processDiscUdemyCourse(
  courseUrl: string,
  existingUrls: Set<string>,
  existingTitles: Set<string>
): Promise<{ saved: boolean; updated?: boolean; skipped?: string; data?: ScrapedCourseData }> {
  try {
    // Fetch the discudemy course page
    const resp = await fetch(courseUrl, {
      headers: getRandomHeaders(),
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    });
    if (!resp.ok) return { saved: false, skipped: 'error' };

    const html = await resp.text();
    const $ = cheerio.load(html);

    // Extract course title
    const title = $('h1').first().text().trim() ||
                  $('header h1').first().text().trim() ||
                  $('title').text().replace(/\s*[-|].*$/, '').trim();

    if (!title || title.length < 5) return { saved: false, skipped: 'no-title' };

    // Title dedup
    const normTitle = normalizeTitle(title);
    if (existingTitles.has(normTitle)) return { saved: false, skipped: 'duplicate-title' };

    // Extract description
    const desc = $('p').first().text().trim() || '';

    // Extract image
    const imageUrl = enhanceImageUrl(
      $('img[src*="udemycdn.com"]').first().attr('src') ||
      $('img').first().attr('src') || ''
    );

    // Extract Udemy URL from couponami.com/go/ link
    let udemyUrl = '';
    let couponCode = '';

    const $goBtn = $('a.discBtn');
    const goLink = $goBtn.attr('href') || '';
    if (goLink) {
      try {
        const goResp = await fetch(goLink.startsWith('http') ? goLink : `https://www.discudemy.com${goLink}`, {
          headers: getRandomHeaders(),
          signal: AbortSignal.timeout(10000),
          redirect: 'follow',
        });
        if (goResp.ok) {
          const goHtml = await goResp.text();
          const $go = cheerio.load(goHtml);
          const $udemyLink = $go('a[href*="udemy.com/course"]').first();
          const udemyHref = $udemyLink.attr('href') || '';
          if (udemyHref) {
            udemyUrl = udemyHref;
            couponCode = extractCouponCode(udemyHref) || '';
          }
        }
      } catch {
        // couponami fetch failed
      }
    }

    // CRITICAL: Only store if we have a valid coupon code
    if (!udemyUrl || !isValidCouponCode(couponCode)) {
      return { saved: false, skipped: 'no-valid-coupon' };
    }

    const normalizedUrl = normalizeUdemyUrl(udemyUrl);
    const couponUrl = udemyUrl;
    const couponExpiry = estimateCouponExpiry(couponCode);

    // --- DEDUP UPDATE: If existing course found, update its coupon ---
    if (existingUrls.has(normalizedUrl)) {
      const upsertResult = await upsertCourseCoupon(normalizedUrl, {
        couponCode,
        couponUrl,
        couponExpiresAt: couponExpiry,
        couponVerified: false,
      });

      if (upsertResult.updated) {
        console.log(`[Scraper/DiscUdemy] Updated coupon for existing course: "${title.substring(0, 40)}" → ${couponCode}`);

        // Verify month/year coupons
        if (couponHasMonthYear(couponCode)) {
          const verifyResult = await verifyCouponOnUdemy(couponUrl);
          if (verifyResult.verified) {
            await upsertCourseCoupon(normalizedUrl, {
              couponCode,
              couponUrl,
              couponExpiresAt: couponExpiry,
              couponVerified: verifyResult.isFree,
            });
          }
        }

        return { saved: false, updated: true };
      }

      return { saved: false, skipped: 'duplicate-url' };
    }

    // Verify coupons with month/year patterns (always for discudemy)
    let couponVerified = false;
    if (couponHasMonthYear(couponCode)) {
      console.log(`[Scraper/DiscUdemy] Verifying coupon for "${title.substring(0, 40)}"...`);
      const verifyResult = await verifyCouponOnUdemy(couponUrl);
      if (verifyResult.verified) {
        couponVerified = verifyResult.isFree;
        if (!verifyResult.isFree) {
          console.log(`[Scraper/DiscUdemy] Coupon verified as NOT FREE for "${title.substring(0, 40)}" - skipping`);
          return { saved: false, skipped: 'expired-coupon' };
        }
        console.log(`[Scraper/DiscUdemy] Coupon verified as FREE for "${title.substring(0, 40)}" ✓`);
      }
    }

    // Extract category from discudemy breadcrumb/section
    const sourceDetail = courseUrl.replace('https://www.discudemy.com/', '').replace('http://www.discudemy.com/', '').replace(/\/$/, '');

    // Build course data
    const courseData: ScrapedCourseData = {
      title,
      description: desc || `تعلم ${title} مع هذه الدورة المجانية الشاملة.`,
      instructor: '',
      category: categorize(title),
      imageUrl,
      udemyUrl,
      couponUrl,
      couponCode,
      couponExpiresAt: couponExpiry,
      isFreeForever: false,
      couponVerified,
      sourceDetail,
      rating: null,
      studentsCount: null,
      originalPrice: null,
      language: null,
      duration: null,
      requirements: '',
      whoFor: '',
      whatLearn: '',
      lastUpdated: null,
      source: 'discudemy',
    };

    // Save to DB
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
      couponExpiresAt: courseData.couponExpiresAt,
      isFreeForever: courseData.isFreeForever,
      sourceDetail: courseData.sourceDetail,
      couponVerified: courseData.couponVerified,
    });

    if (dbResult.created) {
      existingUrls.add(normalizedUrl);
      existingTitles.add(normTitle);
      return { saved: true, data: courseData };
    }
    return { saved: false, skipped: 'db-duplicate' };
  } catch (err) {
    return { saved: false, skipped: 'error' };
  }
}

async function scrapeDiscUdemy(): Promise<SourceResult> {
  const start = Date.now();
  let newCount = 0;
  let dupCount = 0;
  let errCount = 0;
  let expiredCount = 0;
  let updatedCount = 0;
  const allCourses: ScrapedCourseData[] = [];
  const errors: string[] = [];

  try {
    // Pre-load existing for dedup
    const existingCourses = await db.course.findMany({
      select: { udemyUrl: true, title: true },
    });
    const existingUrls = new Set(existingCourses.map(c => normalizeUdemyUrl(c.udemyUrl)));
    const existingTitles = new Set(existingCourses.map(c => normalizeTitle(c.title)));
    console.log(`[Scraper/DiscUdemy] Starting with ${existingCourses.length} existing courses in DB`);

    // Step 1: Fetch /all page to get course listing links
    console.log(`[Scraper/DiscUdemy] Fetching discudemy.com/all...`);
    const allPageResp = await fetch('https://www.discudemy.com/all', {
      headers: getRandomHeaders(),
      signal: AbortSignal.timeout(30000),
      redirect: 'follow',
    });

    if (!allPageResp.ok) {
      throw new Error(`HTTP ${allPageResp.status} for discudemy.com/all`);
    }

    const allPageHtml = await allPageResp.text();
    const $all = cheerio.load(allPageHtml);

    // Extract course page links from the /all page
    const courseLinks: string[] = [];
    $all('a[href]').each((_, el) => {
      const href = $all(el).attr('href') || '';
      const match = href.match(/^https?:\/\/(www\.)?discudemy\.com\/([a-z0-9\-]+)\/?$/i);
      if (match && ![
        'all', 'category', 'about', 'contact', 'feed', 'search',
        'language', 'giveaway', 'frequently-asked-question', 'policies',
      ].includes(match[2])) {
        const fullUrl = href.startsWith('http') ? href : `https://www.discudemy.com/${match[2]}`;
        if (!courseLinks.includes(fullUrl)) {
          courseLinks.push(fullUrl);
        }
      }
    });

    console.log(`[Scraper/DiscUdemy] Found ${courseLinks.length} course links from /all page`);

    // Also fetch some category pages for more courses
    const categoryPages = ['python', 'web-development', 'marketing', 'business', 'design', 'mobile-development-other', 'machine-learning', 'ethical-hacking', 'photography', 'personal-development'];
    for (const catSlug of categoryPages) {
      try {
        const catResp = await fetch(`https://www.discudemy.com/category/${catSlug}`, {
          headers: getRandomHeaders(),
          signal: AbortSignal.timeout(15000),
          redirect: 'follow',
        });
        if (catResp.ok) {
          const catHtml = await catResp.text();
          const $cat = cheerio.load(catHtml);
          $cat('a[href]').each((_, el) => {
            const href = $cat(el).attr('href') || '';
            const match = href.match(/^https?:\/\/(www\.)?discudemy\.com\/([a-z0-9\-]+)\/?$/i);
            if (match && ![
              'all', 'category', 'about', 'contact', 'feed', 'search',
              'language', 'giveaway', 'frequently-asked-question', 'policies',
            ].includes(match[2])) {
              const fullUrl = href.startsWith('http') ? href : `https://www.discudemy.com/${match[2]}`;
              if (!courseLinks.includes(fullUrl)) {
                courseLinks.push(fullUrl);
              }
            }
          });
        }
      } catch {
        // Category page failed, skip
      }
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`[Scraper/DiscUdemy] Total unique course links: ${courseLinks.length}`);

    // Step 2: Process each course page - batch size of 5
    const BATCH_SIZE = 5;
    for (let i = 0; i < courseLinks.length; i += BATCH_SIZE) {
      const batch = courseLinks.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(courseLinks.length / BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(courseUrl => processDiscUdemyCourse(courseUrl, existingUrls, existingTitles))
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          if (result.value.saved) {
            newCount++;
            allCourses.push(result.value.data!);
          } else if (result.value.updated) {
            updatedCount++;
          } else if (['duplicate-title', 'duplicate-url', 'db-duplicate'].includes(result.value.skipped || '')) {
            dupCount++;
          } else if (result.value.skipped === 'no-valid-coupon' || result.value.skipped === 'expired-coupon') {
            expiredCount++;
          } else {
            errCount++;
          }
        } else {
          errCount++;
        }
      }

      if (i + BATCH_SIZE < courseLinks.length) {
        console.log(`[Scraper/DiscUdemy] Batch ${batchNum}/${totalBatches}: ${newCount} new, ${updatedCount} updated, ${dupCount} dup, ${expiredCount} no-coupon, ${errCount} err`);
        await new Promise(r => setTimeout(r, 500));
      }
    }

  } catch (err) {
    errors.push(`Fatal: ${err}`);
    errCount++;
  }

  const duration = Date.now() - start;
  const status = newCount > 0 ? 'success' : (errCount > 0 ? 'error' : 'partial');

  console.log(`[Scraper/DiscUdemy] Done in ${(duration / 1000).toFixed(1)}s: ${newCount} new, ${updatedCount} updated, ${dupCount} dup, ${expiredCount} no-coupon, ${errCount} err`);

  const logEntry: ScraperLogEntry = {
    source: 'discudemy',
    status,
    newCount,
    dupCount,
    errCount,
    message: `${newCount} new, ${updatedCount} updated from discudemy.com, ${dupCount} dup, ${expiredCount} no-valid-coupon, ${errCount} err`,
    duration,
  };
  await logScraperRun(logEntry).catch(() => {});

  return {
    source: 'discudemy',
    status,
    newCount,
    dupCount,
    errCount,
    expiredCount,
    updatedCount,
    message: `DiscUdemy → ${newCount} جديدة، ${updatedCount} محدثة، ${dupCount} مكررة، ${expiredCount} بدون كوبون صالح، ${errCount} أخطاء`,
    duration,
    courses: allCourses,
  };
}

// ============================================
// FreebiesGlobal Scraper
// Fetches trk.udemy.com tracking links from freebiesglobal.com, decodes to get Udemy URLs + coupon codes
// ============================================

async function scrapeFreebiesGlobal(): Promise<SourceResult> {
  const start = Date.now();
  let newCount = 0;
  let dupCount = 0;
  let errCount = 0;
  let expiredCount = 0;
  let updatedCount = 0;
  const allCourses: ScrapedCourseData[] = [];
  const errors: string[] = [];

  try {
    // Pre-load existing for dedup
    const existingCourses = await db.course.findMany({
      select: { udemyUrl: true, title: true },
    });
    const existingUrls = new Set(existingCourses.map(c => normalizeUdemyUrl(c.udemyUrl)));
    const existingTitles = new Set(existingCourses.map(c => normalizeTitle(c.title)));
    console.log(`[Scraper/FreebiesGlobal] Starting with ${existingCourses.length} existing courses in DB`);

    // Fetch homepage + up to 3 pages
    const maxPages = 3;
    const pageUrls = [
      'https://www.freebiesglobal.com/',
      ...Array.from({ length: maxPages - 1 }, (_, i) => `https://www.freebiesglobal.com/page/${i + 2}/`),
    ];

    console.log(`[Scraper/FreebiesGlobal] Fetching ${pageUrls.length} pages...`);

    const pageResults = await Promise.allSettled(
      pageUrls.map(url =>
        fetch(url, {
          headers: getRandomHeaders(),
          signal: AbortSignal.timeout(30000),
          redirect: 'follow',
        }).then(resp => resp.ok ? resp.text() : '').catch(() => '')
      )
    );

    // Parse all pages: extract course entries with title, image, and decoded Udemy URL
    interface FreebiesCourse {
      title: string;
      imageUrl: string;
      udemyUrl: string;
      couponCode: string;
      sourceDetail: string;
    }

    const extractedCourses: FreebiesCourse[] = [];
    const seenUrls = new Set<string>();

    for (const result of pageResults) {
      if (result.status !== 'fulfilled' || !result.value) continue;

      const html = result.value;
      const $ = cheerio.load(html);

      // Find all offer_grid items
      $('.offer_grid').each((_, el) => {
        const $card = $(el);

        // Extract title from h3 > a
        const title = $card.find('h3 a, h2 a').first().text().trim() ||
                      $card.find('h3, h2').first().text().trim();
        if (!title || title.length < 5) return;

        // Extract image
        const imageUrl = enhanceImageUrl(
          $card.find('img[src*="udemycdn.com"]').first().attr('src') ||
          $card.find('img').first().attr('src') || ''
        );

        // Extract trk.udemy.com link and decode it
        const trkHref = $card.find('a[href*="trk.udemy.com"]').first().attr('href') || '';
        if (!trkHref) return;

        try {
          // Decode HTML entities
          let decodedLink = trkHref.replace(/&amp;/g, '&');
          const urlObj = new URL(decodedLink);
          const uParam = urlObj.searchParams.get('u');

          if (uParam) {
            // Double URL decode
            let udemyUrl = decodeURIComponent(decodeURIComponent(uParam));
            const couponCode = extractCouponCode(udemyUrl);
            const normalizedUrl = normalizeUdemyUrl(udemyUrl);

            // Dedup within extraction
            if (seenUrls.has(normalizedUrl)) return;
            seenUrls.add(normalizedUrl);

            // Extract category slug from the page context
            const catLink = $card.find('.cat_link_meta a').first().attr('href') || '';
            const catSlug = catLink.split('/').filter(Boolean).pop() || '';

            extractedCourses.push({
              title: title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
              imageUrl,
              udemyUrl,
              couponCode,
              sourceDetail: catSlug ? `freebiesglobal/${catSlug}` : 'freebiesglobal',
            });
          }
        } catch {
          // URL decode failed, skip this course
        }
      });
    }

    console.log(`[Scraper/FreebiesGlobal] Extracted ${extractedCourses.length} unique courses from ${pageUrls.length} pages`);

    // Step 2: Save to DB in batches (batch size 5 for verification)
    const BATCH_SIZE = 5;
    for (let i = 0; i < extractedCourses.length; i += BATCH_SIZE) {
      const batch = extractedCourses.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(extractedCourses.length / BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(async (course) => {
          try {
            const normTitle = normalizeTitle(course.title);
            if (existingTitles.has(normTitle)) return { saved: false, skipped: 'duplicate-title' };

            const normalizedUrl = normalizeUdemyUrl(course.udemyUrl);

            // CRITICAL: Only store if there's a valid coupon code
            if (!course.couponCode || !isValidCouponCode(course.couponCode)) {
              return { saved: false, skipped: 'no-valid-coupon' };
            }

            // --- DEDUP UPDATE: Update existing course coupon ---
            if (existingUrls.has(normalizedUrl)) {
              const couponCode = course.couponCode;
              const couponUrl = course.udemyUrl;
              const couponExpiry = estimateCouponExpiry(couponCode);

              const upsertResult = await upsertCourseCoupon(normalizedUrl, {
                couponCode,
                couponUrl,
                couponExpiresAt: couponExpiry,
                couponVerified: false,
              });

              if (upsertResult.updated) {
                return { saved: false, updated: true };
              }

              return { saved: false, skipped: 'duplicate-url' };
            }

            const couponCode = course.couponCode;
            const couponUrl = course.udemyUrl;
            const couponExpiry = estimateCouponExpiry(couponCode);

            // FreebiesGlobal is pages 1-3, always verify month/year coupons
            let couponVerified = false;
            if (couponHasMonthYear(couponCode)) {
              const verifyResult = await verifyCouponOnUdemy(couponUrl);
              if (verifyResult.verified) {
                couponVerified = verifyResult.isFree;
                if (!verifyResult.isFree) {
                  return { saved: false, skipped: 'expired-coupon' };
                }
              }
            }

            const courseData: ScrapedCourseData = {
              title: course.title,
              description: `تعلم ${course.title} مع هذه الدورة المجانية الشاملة. حمّلها الآن مجاناً من Udemy.`,
              instructor: '',
              category: categorize(course.title),
              imageUrl: course.imageUrl,
              udemyUrl: course.udemyUrl,
              couponUrl,
              couponCode,
              couponExpiresAt: couponExpiry,
              isFreeForever: false,
              couponVerified,
              sourceDetail: course.sourceDetail,
              rating: null,
              studentsCount: null,
              originalPrice: null,
              language: null,
              duration: null,
              requirements: '',
              whoFor: '',
              whatLearn: '',
              lastUpdated: null,
              source: 'freebiesglobal',
            };

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
              couponExpiresAt: courseData.couponExpiresAt,
              isFreeForever: courseData.isFreeForever,
              sourceDetail: courseData.sourceDetail,
              couponVerified: courseData.couponVerified,
            });

            if (dbResult.created) {
              existingUrls.add(normalizedUrl);
              existingTitles.add(normTitle);
              return { saved: true, data: courseData };
            }
            return { saved: false, skipped: 'db-duplicate' };
          } catch {
            return { saved: false, skipped: 'error' };
          }
        })
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          if (result.value.saved) {
            newCount++;
            allCourses.push(result.value.data!);
          } else if (result.value.updated) {
            updatedCount++;
          } else if (['duplicate-title', 'duplicate-url', 'db-duplicate'].includes(result.value.skipped || '')) {
            dupCount++;
          } else if (result.value.skipped === 'no-valid-coupon' || result.value.skipped === 'expired-coupon') {
            expiredCount++;
          } else {
            errCount++;
          }
        } else {
          errCount++;
        }
      }

      if (i + BATCH_SIZE < extractedCourses.length) {
        console.log(`[Scraper/FreebiesGlobal] Batch ${batchNum}/${totalBatches}: ${newCount} new, ${updatedCount} updated, ${dupCount} dup, ${expiredCount} no-coupon, ${errCount} err`);
        await new Promise(r => setTimeout(r, 200));
      }
    }

  } catch (err) {
    errors.push(`Fatal: ${err}`);
    errCount++;
  }

  const duration = Date.now() - start;
  const status = newCount > 0 ? 'success' : (errCount > 0 ? 'error' : 'partial');

  console.log(`[Scraper/FreebiesGlobal] Done in ${(duration / 1000).toFixed(1)}s: ${newCount} new, ${updatedCount} updated, ${dupCount} dup, ${expiredCount} no-coupon, ${errCount} err`);

  const logEntry: ScraperLogEntry = {
    source: 'freebiesglobal',
    status,
    newCount,
    dupCount,
    errCount,
    message: `${newCount} new, ${updatedCount} updated from freebiesglobal.com, ${dupCount} dup, ${expiredCount} no-valid-coupon, ${errCount} err`,
    duration,
  };
  await logScraperRun(logEntry).catch(() => {});

  return {
    source: 'freebiesglobal',
    status,
    newCount,
    dupCount,
    errCount,
    expiredCount,
    updatedCount,
    message: `FreebiesGlobal → ${newCount} جديدة، ${updatedCount} محدثة، ${dupCount} مكررة، ${errCount} أخطاء`,
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

  const seenTitles = new Map<string, string>();
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
  discudemy: SourceResult;
  freebiesglobal: SourceResult;
  totalNew: number;
  totalDup: number;
  totalErr: number;
  totalUpdated: number;
  totalDuration: number;
}

export async function runFullScrape(options?: {
  pages?: number;
  sources?: string[];
}): Promise<ScrapeResults> {
  const totalStart = Date.now();
  const sources = options?.sources || ['udemyfreebies', 'discudemy', 'freebiesglobal'];
  const maxPages = options?.pages || 20;

  // Clean duplicates before scraping
  await cleanupDuplicates().catch(() => {});

  let totalNew = 0;
  let totalDup = 0;
  let totalErr = 0;
  let totalUpdated = 0;

  let udemyfreebiesResult: SourceResult = {
    source: 'udemyfreebies', status: 'partial', newCount: 0, dupCount: 0, errCount: 0,
    expiredCount: 0, updatedCount: 0, message: 'Skipped', duration: 0, courses: [],
  };
  let discudemyResult: SourceResult = {
    source: 'discudemy', status: 'partial', newCount: 0, dupCount: 0, errCount: 0,
    expiredCount: 0, updatedCount: 0, message: 'Skipped', duration: 0, courses: [],
  };
  let freebiesglobalResult: SourceResult = {
    source: 'freebiesglobal', status: 'partial', newCount: 0, dupCount: 0, errCount: 0,
    expiredCount: 0, updatedCount: 0, message: 'Skipped', duration: 0, courses: [],
  };

  // Run each source
  if (sources.includes('udemyfreebies')) {
    try {
      udemyfreebiesResult = await scrapeUdemyFreebies(maxPages);
      totalNew += udemyfreebiesResult.newCount;
      totalDup += udemyfreebiesResult.dupCount;
      totalErr += udemyfreebiesResult.errCount;
      totalUpdated += udemyfreebiesResult.updatedCount;
    } catch (err) {
      console.error('[Scraper] UdemyFreebies failed:', err);
      udemyfreebiesResult = { source: 'udemyfreebies', status: 'error', newCount: 0, dupCount: 0, errCount: 1, expiredCount: 0, updatedCount: 0, message: String(err), duration: 0, courses: [] };
      totalErr++;
    }
  }

  if (sources.includes('discudemy')) {
    try {
      discudemyResult = await scrapeDiscUdemy();
      totalNew += discudemyResult.newCount;
      totalDup += discudemyResult.dupCount;
      totalErr += discudemyResult.errCount;
      totalUpdated += discudemyResult.updatedCount;
    } catch (err) {
      console.error('[Scraper] DiscUdemy failed:', err);
      discudemyResult = { source: 'discudemy', status: 'error', newCount: 0, dupCount: 0, errCount: 1, expiredCount: 0, updatedCount: 0, message: String(err), duration: 0, courses: [] };
      totalErr++;
    }
  }

  if (sources.includes('freebiesglobal')) {
    try {
      freebiesglobalResult = await scrapeFreebiesGlobal();
      totalNew += freebiesglobalResult.newCount;
      totalDup += freebiesglobalResult.dupCount;
      totalErr += freebiesglobalResult.errCount;
      totalUpdated += freebiesglobalResult.updatedCount;
    } catch (err) {
      console.error('[Scraper] FreebiesGlobal failed:', err);
      freebiesglobalResult = { source: 'freebiesglobal', status: 'error', newCount: 0, dupCount: 0, errCount: 1, expiredCount: 0, updatedCount: 0, message: String(err), duration: 0, courses: [] };
      totalErr++;
    }
  }

  const totalDuration = Date.now() - totalStart;

  console.log(`[Scraper] Full scrape done in ${(totalDuration / 1000).toFixed(1)}s: ${totalNew} new, ${totalUpdated} updated, ${totalDup} dup, ${totalErr} err`);

  return {
    udemyfreebies: udemyfreebiesResult,
    discudemy: discudemyResult,
    freebiesglobal: freebiesglobalResult,
    totalNew,
    totalDup,
    totalErr,
    totalUpdated,
    totalDuration,
  };
}

export { scrapeUdemyFreebies, scrapeDiscUdemy, scrapeFreebiesGlobal };
