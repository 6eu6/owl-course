import * as cheerio from 'cheerio';
import { db } from '@/lib/db';
import {
  logScraperRun,
  createCourseDirect,
  upsertCourseCoupon,
  cleanupInvalidCourses,
  type ScraperLogEntry,
} from './queries';

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

export interface SourceResult {
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


export interface ScrapeResult {
  totalNew: number;
  totalDup: number;
  totalErr: number;
  totalDuration: number;
  udemyfreebies: SourceResult;
  studybullet: SourceResult;
}

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
    let normalized = urlObj.toString().replace(/\?$/, '');
    // Normalize Udemy URLs: ensure /course/ path is present
    // UdemyFreebies redirects to old format: udemy.com/SLUG/ without /course/
    // This causes dedup failures (different from /course/SLUG/ format)
    normalized = normalized.replace(
      /https?:\/\/(?:www\.)?udemy\.com\/(?!course\/)([a-z0-9\-]+)/i,
      'https://www.udemy.com/course/$1'
    );
    return normalized;
  } catch {
    return url;
  }
}

/**
 * Normalize a Udemy course URL to ensure it has the /course/ path.
 * Used for UdemyFreebies redirects that return old-format URLs.
 */
function ensureUdemyCoursePath(url: string): string {
  try {
    // If URL already has /course/, return as-is
    if (/udemy\.com\/course\//i.test(url)) return url;
    // Add /course/ to old-format Udemy URLs: udemy.com/SLUG/ → udemy.com/course/SLUG/
    return url.replace(
      /https?:\/\/(?:www\.)?udemy\.com\/([a-z0-9\-]+)/i,
      'https://www.udemy.com/course/$1'
    );
  } catch {
    return url;
  }
}

/**
 * Extract the real image URL from a cheerio element, handling lazy-loaded images.
 * WordPress lazy-loaded images often have base64 placeholder in src and real URL in data-src.
 */
function extractLazyImage($: cheerio.CheerioAPI, selector: string): string {
  const $el = $(selector).first();
  if ($el.length === 0) return '';
  return extractLazyImageFromElement($el);
}

function extractLazyImageFromElement($el: any): string {
  if (!$el || !$el.attr) return '';
  const el = $el as cheerio.Cheerio<any>;
  const src = el.attr('src') || '';
  const dataSrc = el.attr('data-src') || '';
  const dataLazySrc = el.attr('data-lazy-src') || '';

  // Skip base64 data: URLs (lazy loading placeholders)
  if (src && !src.startsWith('data:')) return src;
  if (dataSrc && !dataSrc.startsWith('data:')) return dataSrc;
  if (dataLazySrc && !dataLazySrc.startsWith('data:')) return dataLazySrc;
  // Fallback: return src even if base64 (will be filtered out later)
  return src;
}

// ============================================
// Category Map & Icons
// ============================================

const CATEGORY_MAP: Record<string, string[]> = {
  'Web Development': ['web', 'html', 'css', 'javascript', 'react', 'angular', 'vue', 'node', 'frontend', 'backend', 'full stack', 'wordpress', 'php', 'django', 'flask', 'laravel', 'next.js', 'nextjs', 'typescript', 'tailwind', 'html5', 'css3', 'bootstrap', 'jquery', 'express', 'svelte', 'graphql', 'rest api'],
  'Mobile Development': ['mobile', 'android', 'ios', 'flutter', 'react native', 'swift', 'kotlin', 'app development', 'swiftui', 'xcode'],
  'Data Science & AI': ['data science', 'machine learning', 'deep learning', 'ai', 'artificial intelligence', 'nlp', 'neural', 'tensorflow', 'pytorch', 'chatgpt', 'gpt', 'llm', 'data analysis', 'computer vision', 'opencv'],
  'Python': ['python', 'django', 'flask', 'pandas', 'numpy', 'matplotlib', 'scipy', 'python 3', 'tkinter'],
  'Cloud & DevOps': ['cloud', 'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'devops', 'terraform', 'ci/cd', 'linux', 'vmware', 'jenkins', 'ansible'],
  'Cybersecurity': ['security', 'cybersecurity', 'ethical hacking', 'penetration', 'network security', 'infosec', 'ceh', 'hacking', 'cyber', 'bug bounty', ' kali linux'],
  'Design': ['design', 'graphic', 'ui/ux', 'ux', 'figma', 'photoshop', 'illustrator', 'adobe', 'canva', 'blender', '3d', 'after effects', 'premiere', 'video editing', 'revit', 'autocad', 'autodesk', 'invision', 'sketch'],
  'Digital Marketing': ['marketing', 'seo', 'sem', 'social media marketing', 'digital marketing', 'google ads', 'facebook ads', 'branding', 'personal branding', 'email marketing', 'content marketing'],
  'Business': ['business', 'management', 'project management', 'entrepreneurship', 'finance', 'accounting', 'excel', 'startup', 'agile', 'scrum', 'product management', 'leadership', 'hr', 'human resources'],
  'Programming & IT': ['it', 'software', 'comptia', 'git', 'database', 'sql', 'oracle', 'networking', 'java', 'c++', 'c#', '.net', 'microsoft', 'power bi', 'tableau', 'rust', 'go', 'golang', 'assembly'],
  'Photography & Video': ['photography', 'photo', 'camera', 'video', 'video editing', 'premiere', 'after effects', 'filmora', 'davinci', 'filmmaking', 'youtube', 'motion graphics'],
  'Personal Development': ['personal development', 'productivity', 'communication', 'leadership', 'motivation', 'mindset', 'life coaching', 'neuroscience', 'subconscious', 'brain', 'resume', 'cv', 'interview', 'time management'],
  'Music': ['music', 'guitar', 'piano', 'drums', 'singing', 'audio', 'music production', 'ableton', 'fl studio'],
  'Languages': ['language', 'english', 'spanish', 'french', 'german', 'japanese', 'chinese', 'arabic', 'ielts', 'toefl'],
  'Finance & Accounting': ['trading', 'forex', 'crypto', 'investment', 'stock', 'financial', 'accounting', 'bookkeeping', 'quickbooks', 'real estate'],
  'Health & Fitness': ['health', 'fitness', 'yoga', 'meditation', 'nutrition', 'diet', 'mental health', 'wellness'],
};

const CATEGORY_ICONS: Record<string, string> = {
  'Web Development': '💻',
  'Mobile Development': '📱',
  'Data Science & AI': '🤖',
  'Python': '🐍',
  'Cloud & DevOps': '☁️',
  'Cybersecurity': '🔒',
  'Design': '🎨',
  'Digital Marketing': '📢',
  'Business': '💼',
  'Programming & IT': '⚙️',
  'Photography & Video': '📷',
  'Personal Development': '🧠',
  'Music': '🎵',
  'Languages': '🌍',
  'Finance & Accounting': '💰',
  'Health & Fitness': '💪',
  'Other': '📚',
};

/** Whole-word/phrase match so e.g. "scenarios" no longer matches "ios". */
function keywordMatches(text: string, keyword: string): boolean {
  const k = keyword.trim();
  if (!k) return false;
  const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Boundaries that aren't letters/digits (allows "node.js", "c++", "c#", "rest api").
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i').test(text);
}

export function categorize(title: string, originalCategory: string = ''): string {
  const text = title.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_MAP)) {
    if (keywords.some(k => keywordMatches(text, k))) {
      return category;
    }
  }
  return 'Other';
}

export { CATEGORY_ICONS };

// ============================================
// Image URL Enhancement
// ============================================

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

// ============================================
// Coupon Extraction & Validation
// ============================================

function extractCouponCode(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('couponCode') || urlObj.searchParams.get('coupon') || '';
  } catch {
    return '';
  }
}

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


// ============================================
// Coupon Expiry Estimation
// ============================================

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
  if (/^[A-Z0-9]{8,}$/.test(couponCode)) {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 3);
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
// Rate Limiting for Udemy Verification
// ============================================

let lastUdemyRequestTime = 0;
let rateLimitBackoffUntil = 0;
let rateLimitBackoffAttempts = 0;

// --- Cloudflare circuit breaker ---
// Udemy sits behind Cloudflare and challenges datacenter IPs (Vercel/Oracle),
// returning 403 "Just a moment" pages that no header tweak can pass. Once we
// see enough consecutive blocks we stop hitting Udemy for the rest of the run
// and simply trust the source coupons (both sources are free-coupon-only).
// This keeps scrapes fast instead of waiting 2s per doomed request.
let udemyConsecutiveBlocks = 0;
let udemyCircuitOpen = false;
const UDEMY_BLOCK_THRESHOLD = 4;

function noteUdemyBlocked(): void {
  udemyConsecutiveBlocks++;
  if (!udemyCircuitOpen && udemyConsecutiveBlocks >= UDEMY_BLOCK_THRESHOLD) {
    udemyCircuitOpen = true;
    console.log(`[Scraper] Udemy appears Cloudflare-blocked (${udemyConsecutiveBlocks} consecutive blocks). Skipping further Udemy verification this run — trusting source coupons.`);
  }
}

function noteUdemyReachable(): void {
  udemyConsecutiveBlocks = 0;
}

/** Reset the circuit breaker at the start of each full scrape. */
function resetUdemyCircuit(): void {
  udemyConsecutiveBlocks = 0;
  udemyCircuitOpen = false;
}

/**
 * Wait if we're rate-limited or need to throttle requests.
 * Returns true if we should skip this request (still in backoff).
 */
async function waitForRateLimit(): Promise<boolean> {
  if (rateLimitBackoffUntil > Date.now()) {
    const waitMs = rateLimitBackoffUntil - Date.now();
    console.log(`[Scraper] Rate limited, backing off for ${Math.ceil(waitMs / 1000)}s (attempt ${rateLimitBackoffAttempts})...`);
    await new Promise(r => setTimeout(r, waitMs));
    rateLimitBackoffUntil = 0;
    return false;
  }

  // Minimum 2s between Udemy requests (increased from 1.5s)
  const now = Date.now();
  const elapsed = now - lastUdemyRequestTime;
  if (elapsed < 2000) {
    await new Promise(r => setTimeout(r, 2000 - elapsed));
  }
  lastUdemyRequestTime = Date.now();
  return false;
}

// ============================================
// Random User-Agent Rotation (10 total)
// ============================================

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
];

function getRandomHeaders(): Record<string, string> {
  return {
    'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  };
}

// ============================================
// Verification Sampling Logic (Improved)
// ============================================

/**
 * Determine if a course should be verified based on its page position and coupon code.
 * - Pages 1-2 (index 0-1): verify every course (most likely fresh)
 * - Pages 3-5 (index 2-4): verify every course
 * - Pages 6+ (index 5+): sample 50% of courses
 * - If coupon has month/year pattern (e.g. JUL2025): always verify
 */
function shouldVerifyCoupon(pageIndex: number, couponCode: string): boolean {
  // Pages 0-4 (1-5): always verify (ensures first 5 pages fully verified)
  if (pageIndex < 5) return true;
  // Month/year coupons: always verify
  if (couponHasMonthYear(couponCode)) return true;
  // Pages 6+: 50% sampling (increased from 30%)
  return Math.random() < 0.5;
}

// ============================================
// Udemy Coupon Verification
// ============================================

/**
 * Check if a response HTML is a Cloudflare challenge page (anti-bot protection).
 * When Udemy serves these, all verification attempts will fail inconclusively.
 */
function isCloudflareChallenge(html: string): boolean {
  return html.includes('Just a moment') &&
    html.includes('cloudflare') &&
    html.length < 20000; // CF challenge pages are small
}

/**
 * Verify if a Udemy coupon is still active by checking the course page.
 * Improved: Checks JSON data blocks in <script> tags for pricing data,
 * since Udemy embeds pricing info in __NEXT_DATA__ or __APOLLO_STATE__.
 * Also has exponential backoff on 429.
 * Handles Cloudflare challenge pages gracefully.
 */
async function verifyCouponOnUdemy(couponUrl: string): Promise<{ isFree: boolean; verified: boolean }> {
  // Circuit breaker: Udemy is Cloudflare-blocked for this run — don't waste time.
  if (udemyCircuitOpen) return { isFree: false, verified: false };
  try {
    const shouldSkip = await waitForRateLimit();
    if (shouldSkip) return { isFree: false, verified: false };

    const response = await fetch(couponUrl, {
      headers: getRandomHeaders(),
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });

    // Handle rate limiting (429) with exponential backoff
    if (response.status === 429) {
      rateLimitBackoffAttempts++;
      const backoffMs = Math.min(5000 * Math.pow(2, rateLimitBackoffAttempts - 1), 15000);
      console.log(`[Scraper] Udemy returned 429 - rate limited. Backing off for ${backoffMs / 1000}s (attempt ${rateLimitBackoffAttempts})...`);
      rateLimitBackoffUntil = Date.now() + backoffMs;
      return { isFree: false, verified: false };
    }

    // Reset backoff attempts on success
    rateLimitBackoffAttempts = 0;

    // 403/503 from Udemy are Cloudflare blocks on datacenter IPs.
    if (response.status === 403 || response.status === 503) {
      noteUdemyBlocked();
      return { isFree: false, verified: false };
    }
    if (!response.ok) return { isFree: false, verified: false };

    const html = await response.text();
    const htmlLower = html.toLowerCase();

    // --- CLOUDFLARE CHECK: If Udemy serves a Cloudflare challenge page,
    // we cannot verify the coupon. Return inconclusive (verified: false). ---
    if (isCloudflareChallenge(html)) {
      noteUdemyBlocked();
      console.log(`[Scraper] Udemy returned Cloudflare challenge page - cannot verify coupon`);
      return { isFree: false, verified: false };
    }

    // We reached a real Udemy page — reset the block counter.
    noteUdemyReachable();

    // --- STRATEGY 0: Parse __NEXT_DATA__ JSON properly ---
    const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
      try {
        const jsonData = JSON.parse(nextDataMatch[1]);
        const courseData = jsonData?.props?.pageProps?.course || jsonData?.props?.pageProps?.courseResult;
        if (courseData) {
          // isPaid is the most reliable free/paid indicator from Udemy's data model
          if (courseData.isPaid === false) return { isFree: true, verified: true };
          if (courseData.isPaid === true) return { isFree: false, verified: true };

          // Check frontendDisplayPrice string (e.g. "Free" or "$12.99")
          if (typeof courseData.frontendDisplayPrice === 'string') {
            const displayPrice = courseData.frontendDisplayPrice.trim().toLowerCase();
            if (displayPrice === 'free' || displayPrice === 'free!') return { isFree: true, verified: true };
          }

          // Check buyable field (Udemy uses buyable: false for free courses)
          if (courseData.buyable === false) return { isFree: true, verified: true };

          if (courseData.isFree === true) return { isFree: true, verified: true };
          if (courseData.isFree === false) return { isFree: false, verified: true };

          // Check nested price objects (current/discounted price, NOT list price)
          const price = courseData.price || courseData.purchasePrice || courseData.discountPrice || {};
          if (price && typeof price.amount === 'number') {
            if (price.amount === 0) return { isFree: true, verified: true };
            if (price.amount > 0) return { isFree: false, verified: true };
          }

          const currentPrice = courseData.currentPrice || courseData.frontendPrice || {};
          if (currentPrice && typeof currentPrice.amount === 'number') {
            if (currentPrice.amount === 0) return { isFree: true, verified: true };
            if (currentPrice.amount > 0) return { isFree: false, verified: true };
          }

          // NOTE: We intentionally do NOT use listPrice.amount > 0 as a "not free" indicator
          // because listPrice is the ORIGINAL price before discount, not the current price.
          // A course with listPrice = $89.99 can still be free with an active coupon.
        }
      } catch {
        // JSON parse failed, continue to regex strategies
      }
    }

    // --- STRATEGY 1: Check JSON data blocks in <script> tags (regex fallback) ---
    const scriptBlocks = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];

    for (const block of scriptBlocks) {
      // Check __NEXT_DATA__ for pricing info (regex patterns — used only if JSON parse fails)
      if (block.includes('__NEXT_DATA__')) {
        const jsonPatterns = [
          { pattern: /"isFree"\s*:\s*true/i, free: true },
          { pattern: /"purchase_price"\s*:\s*\{[^}]*"amount"\s*:\s*0(?![.0-9])/i, free: true },
          { pattern: /"price"\s*:\s*0(?![.0-9])/i, free: true },
          { pattern: /"price_amount"\s*:\s*0(?![.0-9])/i, free: true },
          { pattern: /"current_price"\s*:\s*"?0"/i, free: true },
          { pattern: /"discount_price"\s*:\s*\{[^}]*"amount"\s*:\s*0(?![.0-9])/i, free: true },
          { pattern: /"list_price"\s*:\s*\{[^}]*"amount"\s*:\s*0(?![.0-9])/i, free: true },
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
        try {
          const apolloMatch = block.match(/__APOLLO_STATE__\s*=\s*({[\s\S]*?})\s*;?\s*$/m);
          if (apolloMatch) {
            const apolloContent = apolloMatch[1];
            const apolloLower = apolloContent.toLowerCase();

            if (
              apolloLower.includes('"isfree":true') ||
              apolloLower.includes('"is_free":true') ||
              /"price"\s*:\s*0(?![.0-9])/.test(apolloLower) ||
              /"currentprice"\s*:\s*"?0"/i.test(apolloLower) ||
              /"price_amount"\s*:\s*0(?![.0-9])/.test(apolloLower)
            ) {
              return { isFree: true, verified: true };
            }

            if (
              /"currentprice"\s*:\s*"[1-9]/i.test(apolloLower) ||
              /"price_amount"\s*:\s*[1-9]/.test(apolloLower) ||
              /"purchase_price"\s*:\s*\{[^}]*"amount"\s*:\s*[1-9]/.test(apolloLower)
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

    // --- STRATEGY 2: HTML indicators (fallback — less reliable) ---
    // Only use specific indicators that are unlikely to cause false positives
    const freeIndicators = [
      'enroll for free',
      'data-purpose="enroll-free"',
    ];

    const paidIndicators = [
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

    // Require strong signal: both indicators must agree
    if (freeScore >= 1 && paidScore === 0) return { isFree: true, verified: true };
    if (paidScore >= 1 && freeScore === 0) return { isFree: false, verified: true };

    return { isFree: false, verified: false };
  } catch {
    return { isFree: false, verified: false };
  }
}

// ============================================
// Udemy Course Enrichment Data Extraction
// ============================================

interface UdemyCourseEnrichment {
  description: string;       // from headline
  whatLearn: string;         // from what_you_will_learn joined with " • "
  requirements: string;      // from requirements joined with " • "
  whoFor: string;            // from target_audiences joined with " • "
  instructor: string;        // from visible_instructors display_name
  duration: string | null;  // from content_length_text
  lastUpdated: string | null; // from last_modified_date
  rating: number | null;    // from rating
  studentsCount: number | null; // from num_subscribers
  language: string | null;  // from locale.locale
  originalPrice: string | null; // from list_price.price_string
}

/**
 * Extract enrichment data from Udemy's __NEXT_DATA__ course JSON.
 * Used by verifyAndEnrichFromUdemy to get rich course data in a single request.
 */
function extractUdemyPageData(courseData: any): UdemyCourseEnrichment | null {
  if (!courseData) return null;

  const description = typeof courseData.headline === 'string' ? courseData.headline : '';

  // What you'll learn
  const whatLearnItems: string[] = [];
  try {
    const wylData = courseData.what_you_will_learn?.data?.items;
    if (Array.isArray(wylData)) {
      for (const item of wylData) {
        if (item?.text) whatLearnItems.push(item.text);
      }
    }
  } catch { /* ignore */ }
  const whatLearn = whatLearnItems.join(' • ');

  // Requirements
  const requirementItems: string[] = [];
  try {
    const reqData = courseData.requirements?.data?.items;
    if (Array.isArray(reqData)) {
      for (const item of reqData) {
        if (item?.text) requirementItems.push(item.text);
      }
    }
  } catch { /* ignore */ }
  const requirements = requirementItems.join(' • ');

  // Target audience (who this course is for)
  const targetItems: string[] = [];
  try {
    const taData = courseData.target_audiences?.data?.items;
    if (Array.isArray(taData)) {
      for (const item of taData) {
        if (item?.text) targetItems.push(item.text);
      }
    }
  } catch { /* ignore */ }
  const whoFor = targetItems.join(' • ');

  // Instructor(s)
  const instructors = courseData.visible_instructors || [];
  const instructor = instructors
    .map((i: any) => i?.display_name || i?.name || '')
    .filter(Boolean)
    .join(', ');

  // Duration
  const duration = typeof courseData.content_length_text === 'string' ? courseData.content_length_text : null;

  // Last updated
  let lastUpdated: string | null = null;
  if (courseData.last_modified_date) {
    try {
      lastUpdated = new Date(courseData.last_modified_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch { /* ignore */ }
  }

  // Rating
  const rating = typeof courseData.rating === 'number' ? Math.round(courseData.rating * 10) / 10 : null;

  // Students count
  const studentsCount = typeof courseData.num_subscribers === 'number' ? courseData.num_subscribers : null;

  // Language
  const locale = courseData.locale;
  const language = locale?.locale || null;

  // Original price
  const listPrice = courseData.list_price || courseData.listPrice || {};
  const originalPrice = listPrice?.price_string || null;

  return { description, whatLearn, requirements, whoFor, instructor, duration, lastUpdated, rating, studentsCount, language, originalPrice };
}

// ============================================
// Combined Verify + Enrich from Udemy Page
// ============================================

/**
 * Fetch a Udemy course page (with coupon applied) and return both
 * verification result AND enrichment data in a single request.
 * This avoids making two separate requests (verify + detail page).
 */
async function verifyAndEnrichFromUdemy(couponUrl: string): Promise<{
  isFree: boolean;
  verified: boolean;
  enrichment: UdemyCourseEnrichment | null;
}> {
  // Circuit breaker: Udemy is Cloudflare-blocked for this run — don't waste time.
  if (udemyCircuitOpen) return { isFree: false, verified: false, enrichment: null };
  try {
    const shouldSkip = await waitForRateLimit();
    if (shouldSkip) return { isFree: false, verified: false, enrichment: null };

    const response = await fetch(couponUrl, {
      headers: getRandomHeaders(),
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });

    // Handle rate limiting (429) with exponential backoff
    if (response.status === 429) {
      rateLimitBackoffAttempts++;
      const backoffMs = Math.min(5000 * Math.pow(2, rateLimitBackoffAttempts - 1), 15000);
      console.log(`[Scraper] Udemy returned 429 - rate limited. Backing off for ${backoffMs / 1000}s (attempt ${rateLimitBackoffAttempts})...`);
      rateLimitBackoffUntil = Date.now() + backoffMs;
      return { isFree: false, verified: false, enrichment: null };
    }

    // Reset backoff attempts on success
    rateLimitBackoffAttempts = 0;

    // 403/503 from Udemy are Cloudflare blocks on datacenter IPs.
    if (response.status === 403 || response.status === 503) {
      noteUdemyBlocked();
      return { isFree: false, verified: false, enrichment: null };
    }
    if (!response.ok) return { isFree: false, verified: false, enrichment: null };

    const html = await response.text();
    const htmlLower = html.toLowerCase();

    // --- CLOUDFLARE CHECK ---
    if (isCloudflareChallenge(html)) {
      noteUdemyBlocked();
      console.log(`[Scraper] Udemy returned Cloudflare challenge page - cannot verify/enrich coupon`);
      return { isFree: false, verified: false, enrichment: null };
    }

    // We reached a real Udemy page — reset the block counter.
    noteUdemyReachable();

    // --- STRATEGY 0: Parse __NEXT_DATA__ JSON properly ---
    const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
      try {
        const jsonData = JSON.parse(nextDataMatch[1]);
        const courseData = jsonData?.props?.pageProps?.course || jsonData?.props?.pageProps?.courseResult;
        if (courseData) {
          const enrichment = extractUdemyPageData(courseData);

          // isPaid is the most reliable free/paid indicator
          if (courseData.isPaid === false) return { isFree: true, verified: true, enrichment };
          if (courseData.isPaid === true) {
            // Could still be free if coupon makes it $0 — check more indicators below
          }

          // Check frontendDisplayPrice string
          if (typeof courseData.frontendDisplayPrice === 'string') {
            const displayPrice = courseData.frontendDisplayPrice.trim().toLowerCase();
            if (displayPrice === 'free' || displayPrice === 'free!') return { isFree: true, verified: true, enrichment };
          }

          // Check buyable field
          if (courseData.buyable === false) return { isFree: true, verified: true, enrichment };

          if (courseData.isFree === true) return { isFree: true, verified: true, enrichment };
          if (courseData.isFree === false) return { isFree: false, verified: true, enrichment };

          // Check current/discounted price
          const price = courseData.price || courseData.purchasePrice || courseData.discountPrice || {};
          if (price && typeof price.amount === 'number') {
            if (price.amount === 0) return { isFree: true, verified: true, enrichment };
            if (price.amount > 0) return { isFree: false, verified: true, enrichment };
          }

          const currentPrice = courseData.currentPrice || courseData.frontendPrice || {};
          if (currentPrice && typeof currentPrice.amount === 'number') {
            if (currentPrice.amount === 0) return { isFree: true, verified: true, enrichment };
            if (currentPrice.amount > 0) return { isFree: false, verified: true, enrichment };
          }

          // We have courseData but couldn't determine price conclusively
          // Return enrichment even if unverified (caller can use it for metadata)
          return { isFree: false, verified: false, enrichment };
        }
      } catch {
        // JSON parse failed, fall through to HTML strategies
      }
    }

    // --- HTML fallback (no enrichment from JSON, just verification) ---
    const freeIndicators = ['enroll for free', 'data-purpose="enroll-free"'];
    const paidIndicators = ['data-purpose="buy'];

    let freeScore = 0;
    let paidScore = 0;

    for (const indicator of freeIndicators) {
      if (htmlLower.includes(indicator)) freeScore++;
    }
    for (const indicator of paidIndicators) {
      if (htmlLower.includes(indicator)) paidScore++;
    }

    if (freeScore >= 1 && paidScore === 0) return { isFree: true, verified: true, enrichment: null };
    if (paidScore >= 1 && freeScore === 0) return { isFree: false, verified: true, enrichment: null };

    return { isFree: false, verified: false, enrichment: null };
  } catch {
    return { isFree: false, verified: false, enrichment: null };
  }
}

// ============================================
// Helper: Extract Udemy URL from any HTML content
// ============================================

/**
 * Search HTML text for embedded Udemy URLs with coupon codes.
 * Useful as a fallback when redirect extraction fails.
 */
function findUdemyUrlInHtml(html: string): { udemyUrl: string; couponCode: string } | null {
  // Look for udemy.com URLs with couponCode or coupon parameters
  const urlPattern = /https?:\/\/(?:www\.)?udemy\.com\/[^\s"'<>]+(?:couponCode|coupon)=[A-Za-z0-9_\-]+/gi;
  const matches = html.match(urlPattern);
  if (matches) {
    for (const match of matches) {
      const cleaned = ensureUdemyCoursePath(match.replace(/['"<>\\]/g, ''));
      const code = extractCouponCode(cleaned);
      if (code && isValidCouponCode(code)) {
        return { udemyUrl: cleaned, couponCode: code };
      }
    }
  }

  // Look for udemy.com/course/ URLs (even without coupons)
  const courseUrlPattern = /https?:\/\/(?:www\.)?udemy\.com\/course\/[a-z0-9\-]+\/?/gi;
  const courseMatches = html.match(courseUrlPattern);
  if (courseMatches && courseMatches.length > 0) {
    // Return first match even without coupon (caller can decide)
    const cleaned = courseMatches[0].replace(/['"<>\\]/g, '');
    if (cleaned.includes('udemy.com/course/')) {
      return null; // No coupon found, caller handles
    }
  }

  return null;
}

// ============================================
// Helper: Extract ALL Udemy coupon URLs from HTML (regex-based)
// ============================================

/**
 * Extract ALL unique Udemy course URLs with coupon codes from raw HTML.
 * Returns deduplicated entries by course slug, with titles and images extracted
 * from nearby HTML context. Primary method for sources that embed Udemy URLs directly in the page.
 */
function extractAllUdemyCouponEntries(html: string): Array<{ udemyUrl: string; couponCode: string; title: string; imageUrl: string; category: string }> {
  const entries: Array<{ udemyUrl: string; couponCode: string; title: string; imageUrl: string; category: string }> = [];
  const seenSlugs = new Set<string>();

  // Regex: find udemy.com/course/{slug}/?couponCode={CODE} or ?coupon={CODE}
  const urlPattern = /https?:\/\/(?:www\.)?udemy\.com\/course\/([a-z0-9\-]+)\/?(?:\?[^"'\s<>]*?(?:couponCode|coupon)=([A-Za-z0-9_\-]+)[^"'\s<>]*)?/gi;

  let match;
  while ((match = urlPattern.exec(html)) !== null) {
    const slug = match[1];
    const couponCode = match[2];
    if (!couponCode || !isValidCouponCode(couponCode)) continue;
    if (seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);

    const cleanedUrl = match[0].replace(/['"<>\\]/g, '');
    const title = extractTitleNearHtmlPosition(html, match.index, slug);
    const imageUrl = extractImageNearHtmlPosition(html, match.index);
    const category = categorize(title);

    entries.push({ udemyUrl: cleanedUrl, couponCode, title, imageUrl, category });
  }

  return entries;
}

/**
 * Find the nearest heading or link text to a position in HTML, used for
 * associating titles with Udemy URLs found via regex.
 */
function extractTitleNearHtmlPosition(html: string, urlIndex: number, fallbackSlug: string): string {
  const windowSize = 1000;
  const start = Math.max(0, urlIndex - windowSize);
  const before = html.substring(start, urlIndex);

  // Try headings first (most reliable title source)
  let lastHeading = '';
  const hRegex = /<h[2-6][^>]*>([\s\S]*?)<\/h[2-6]>/gi;
  let hMatch;
  while ((hMatch = hRegex.exec(before)) !== null) {
    const text = hMatch[1].replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
    if (text.length > 10) lastHeading = text;
  }
  if (lastHeading) return lastHeading;

  // Try <a> with title attribute
  const aTitleRegex = /<a[^>]*title="([^"]+)"/gi;
  let aTitle = '';
  let aMatch;
  while ((aMatch = aTitleRegex.exec(before)) !== null) {
    if (aMatch[1].length > 10) aTitle = aMatch[1];
  }
  if (aTitle) return aTitle;

  // Try <a> with text content
  const aTextRegex = /<a[^>]*>([^<]{10,})<\/a>/gi;
  let aText = '';
  let atMatch;
  while ((atMatch = aTextRegex.exec(before)) !== null) {
    const text = atMatch[1].trim();
    if (text.length > 10) aText = text;
  }
  if (aText) return aText;

  // Fallback: readable title from slug
  return fallbackSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Find the nearest Udemy CDN image to a position in HTML.
 */
function extractImageNearHtmlPosition(html: string, urlIndex: number): string {
  const windowSize = 600;
  const start = Math.max(0, urlIndex - windowSize);
  const before = html.substring(start, urlIndex);

  const imgRegex = /<img[^>]+src="([^"]+)"/gi;
  let lastImgUrl = '';
  let imgMatch;
  while ((imgMatch = imgRegex.exec(before)) !== null) {
    const src = imgMatch[1];
    if (src.includes('udemycdn.com') || src.includes('udemy.com')) {
      lastImgUrl = src;
    }
  }
  if (lastImgUrl) return enhanceImageUrl(lastImgUrl);

  // Check after the URL too
  const after = html.substring(urlIndex, Math.min(html.length, urlIndex + 300));
  const afterImgRegex = /<img[^>]+src="([^"]+)"/gi;
  let afterMatch;
  while ((afterMatch = afterImgRegex.exec(after)) !== null) {
    const src = afterMatch[1];
    if (src.includes('udemycdn.com') || src.includes('udemy.com')) {
      return enhanceImageUrl(src);
    }
  }

  return lastImgUrl;
}

/**
 * Search HTML for an explicitly shown coupon code (some sites display it in a <code> or <span>).
 */
function findCouponCodeInHtml(html: string): string {
  const $ = cheerio.load(html);
  const codeSelectors = [
    '.coupon-code',
    '.coupon_code',
    '.discount-code',
    '.discount_code',
    '#coupon',
    'code.coupon',
    'span.coupon',
    '.ui-code',
  ];

  for (const sel of codeSelectors) {
    const $el = $(sel);
    if ($el.length > 0) {
      const code = $el.first().text().trim();
      if (code && isValidCouponCode(code)) {
        return code;
      }
    }
  }

  return '';
}

// ============================================
// Helper: Save a scraped course to DB (shared by all sources)
// ============================================

async function saveScrapedCourse(
  courseData: ScrapedCourseData,
  existingUrls: Set<string>,
  existingTitles: Set<string>,
): Promise<{ saved: boolean; updated?: boolean; skipped?: string; data?: ScrapedCourseData }> {
  try {
    const normTitle = normalizeTitle(courseData.title);
    if (existingTitles.has(normTitle)) {
      return { saved: false, skipped: 'duplicate-title' };
    }

    const baseUrl = normalizeUdemyUrl(courseData.udemyUrl);

    // --- DEDUP: course already stored → no DB write at all ---
    // Sources hand us links already carrying their coupon, so an existing course
    // never needs a coupon refresh. Skipping the write here is the single biggest
    // operation saving: an already-known course costs zero database operations.
    if (existingUrls.has(baseUrl)) {
      return { saved: false, skipped: 'duplicate-url' };
    }

    // --- NEW COURSE ---
    const dbResult = await createCourseDirect({
      title: courseData.title,
      slug: slugify(courseData.title),
      description: courseData.description,
      instructor: courseData.instructor,
      category: courseData.category,
      imageUrl: courseData.imageUrl,
      udemyUrl: baseUrl,
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
      existingUrls.add(baseUrl);
      existingTitles.add(normTitle);
      return { saved: true, data: courseData };
    }

    return { saved: false, skipped: 'db-duplicate' };
  } catch (err) {
    console.error(`[Scraper] Error saving "${courseData.title.substring(0, 40)}":`, err);
    return { saved: false, skipped: 'error' };
  }
}

// ============================================
// Helper: Verify and filter courses, delete expired ones
// ============================================

/**
 * Post-scrape verification sweep: re-verify all newly added courses' coupons
 * and remove those that are confirmed expired/not free.
 */
async function postScrapeVerificationSweep(newlyAddedCourses: ScrapedCourseData[]): Promise<{ removed: number; verifiedFree: number; verifiedExpired: number }> {
  let removed = 0;
  let verifiedFree = 0;
  let verifiedExpired = 0;

  if (newlyAddedCourses.length === 0) return { removed: 0, verifiedFree: 0, verifiedExpired: 0 };

  console.log(`[Scraper] Running post-scrape verification sweep on ${newlyAddedCourses.length} newly added courses...`);

  for (const course of newlyAddedCourses) {
    try {
      const result = await verifyCouponOnUdemy(course.couponUrl);
      if (result.verified) {
        if (result.isFree) {
          verifiedFree++;
          // Update DB to mark as verified
          await upsertCourseCoupon(course.udemyUrl, {
            couponCode: course.couponCode,
            couponUrl: course.couponUrl,
            couponExpiresAt: course.couponExpiresAt,
            couponVerified: true,
          });
        } else {
          // Confirmed expired — remove from DB
          verifiedExpired++;
          const baseUrl = normalizeUdemyUrl(course.udemyUrl);
          const existing = await db.course.findFirst({ where: { udemyUrl: baseUrl } });
          if (existing) {
            await db.course.delete({ where: { id: existing.id } });
            removed++;
            console.log(`[Scraper] Post-sweep: removed expired course "${course.title.substring(0, 40)}"`);
          }
        }
      }
    } catch {
      // Skip errors in sweep
    }
  }

  console.log(`[Scraper] Post-scrape sweep done: ${verifiedFree} confirmed free, ${verifiedExpired} expired (removed), ${newlyAddedCourses.length - verifiedFree - verifiedExpired} unverified`);
  return { removed, verifiedFree, verifiedExpired };
}

// ============================================
// Helper: Remove old courses with expired coupons (>7 days)
// ============================================

async function removeOldExpiredCourses(): Promise<{ removed: number }> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Find courses that have a coupon expiry in the past (>7 days old)
  const oldCourses = await db.course.findMany({
    where: {
      couponExpiresAt: {
        lt: sevenDaysAgo,
      },
    },
    select: { id: true },
  });

  if (oldCourses.length === 0) return { removed: 0 };

  const ids = oldCourses.map(c => c.id);
  const result = await db.course.deleteMany({
    where: { id: { in: ids } },
  });

  console.log(`[Scraper] Removed ${result.count} old courses with expired coupons (>7 days)`);
  return { removed: result.count };
}

// ============================================
// UdemyFreebies Scraper - Listing Page
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
      pageIndex: pageNum - 1,
    });
  });

  return courses;
}

async function fetchUdemyFreebiesListingPage(pageNum: number): Promise<{ courses: ListingCourse[]; hasMore: boolean }> {
  const url = pageNum === 1
    ? 'https://www.udemyfreebies.com/'
    : `https://www.udemyfreebies.com/free-udemy-courses/${pageNum}`;

  const response = await fetch(url, {
    headers: getRandomHeaders(),
    signal: AbortSignal.timeout(10000),
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
// UdemyFreebies Scraper - Improved Redirect URL Extraction
// ============================================

/**
 * Extract Udemy URL with coupon from a UdemyFreebies detail page.
 * Improved with 3 fallback strategies:
 *  1. Follow redirect from /out/{slug} and capture Location header
 *  2. Follow redirect and check final URL
 *  3. Scrape detail page HTML for embedded Udemy URLs / coupon codes
 */
async function extractUdemyUrl(detailUrl: string): Promise<{ udemyUrl: string; couponCode: string } | null> {
  try {
    const slugMatch = detailUrl.match(/free-udemy-course\/(.+?)$/);
    if (!slugMatch) return null;

    const outUrl = `https://www.udemyfreebies.com/out/${slugMatch[1]}`;

    // Strategy 1: Try manual redirect to capture the Location header (with Referer to avoid 403)
    try {
      const response = await fetch(outUrl, {
        headers: {
          ...getRandomHeaders(),
          'Referer': 'https://www.udemyfreebies.com/',
          'Origin': 'https://www.udemyfreebies.com',
        },
        signal: AbortSignal.timeout(8000),
        redirect: 'manual',
      });

      const location = response.headers.get('location');
      if (location && location.includes('udemy.com')) {
        const normalizedLocation = ensureUdemyCoursePath(location);
        const couponCode = extractCouponCode(normalizedLocation);
        if (couponCode && isValidCouponCode(couponCode)) {
          return { udemyUrl: normalizedLocation, couponCode };
        }
        if (normalizedLocation.includes('couponCode=')) {
          try {
            const urlObj = new URL(normalizedLocation);
            const code = urlObj.searchParams.get('couponCode') || urlObj.searchParams.get('coupon');
            if (code && isValidCouponCode(code)) {
              return { udemyUrl: normalizedLocation, couponCode: code };
            }
          } catch { /* invalid URL */ }
        }
        // Has a Udemy URL but no valid coupon — try to construct one from detail page
      }
    } catch {
      // Strategy 1 failed, continue
    }

    // Strategy 2: Follow redirects and check final URL (with Referer to avoid 403)
    try {
      const followResp = await fetch(outUrl, {
        headers: {
          ...getRandomHeaders(),
          'Referer': 'https://www.udemyfreebies.com/',
          'Origin': 'https://www.udemyfreebies.com',
        },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      });
      const finalUrl = followResp.url;
      if (finalUrl && finalUrl.includes('udemy.com')) {
        const normalizedFinalUrl = ensureUdemyCoursePath(finalUrl);
        const couponCode = extractCouponCode(normalizedFinalUrl);
        if (couponCode && isValidCouponCode(couponCode)) {
          return { udemyUrl: normalizedFinalUrl, couponCode };
        }
      }

      // Strategy 2a: Check the followed response HTML for embedded Udemy links
      try {
        const html = await followResp.text();
        const htmlResult = findUdemyUrlInHtml(html);
        if (htmlResult) {
          return htmlResult;
        }
      } catch {
        // HTML parsing failed, continue
      }
    } catch {
      // Strategy 2 failed, continue
    }

    // Strategy 3: Scrape the detail page itself for embedded Udemy URLs / coupon codes
    try {
      const detailResp = await fetch(detailUrl, {
        headers: getRandomHeaders(),
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      });
      if (detailResp.ok) {
        const detailHtml = await detailResp.text();

        // 3a: Look for Udemy URLs with coupon in the HTML
        const htmlResult = findUdemyUrlInHtml(detailHtml);
        if (htmlResult) {
          return htmlResult;
        }

        // 3b: Look for a standalone coupon code and a Udemy course URL separately
        const couponCode = findCouponCodeInHtml(detailHtml);
        const $ = cheerio.load(detailHtml);
        const udemyLink = $('a[href*="udemy.com/course/"]').first().attr('href') || '';
        if (couponCode && udemyLink) {
          try {
            const udemyUrlObj = new URL(udemyLink.startsWith('http') ? udemyLink : `https://www.udemy.com${udemyLink}`);
            udemyUrlObj.searchParams.set('couponCode', couponCode);
            return { udemyUrl: udemyUrlObj.toString(), couponCode };
          } catch {
            // URL parse failed
          }
        }

        // 3c: Look for any Udemy link without coupon, combine with coupon code
        if (couponCode) {
          const anyUdemyUrl = detailHtml.match(/https?:\/\/(?:www\.)?udemy\.com\/course\/[a-z0-9\-]+/i);
          if (anyUdemyUrl) {
            const fullUrl = `${anyUdemyUrl[0]}?couponCode=${couponCode}`;
            return { udemyUrl: fullUrl, couponCode };
          }
        }

        // 3d: Deep scan all <script> tags for dynamically constructed Udemy URLs
        const scriptTags = detailHtml.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
        for (const scriptTag of scriptTags) {
          const tagContent = scriptTag.replace(/<\/script>|<script[^>]*>/gi, '');
          if (tagContent.includes('udemy.com/course/')) {
            const scriptEntries = extractAllUdemyCouponEntries(tagContent);
            if (scriptEntries.length > 0) {
              return { udemyUrl: scriptEntries[0].udemyUrl, couponCode: scriptEntries[0].couponCode };
            }
          }
        }

        // 3e: Check for encoded/obfuscated Udemy URLs (base64 or rot13 patterns)
        const encodedPattern = /(?:atob|btoa|decodeURIComponent|String\.fromCharCode)\s*\(["']([A-Za-z0-9+/=]+)["']\)/g;
        let encMatch;
        while ((encMatch = encodedPattern.exec(detailHtml)) !== null) {
          try {
            const decoded = Buffer.from(encMatch[1], 'base64').toString('utf-8');
            if (decoded.includes('udemy.com')) {
              const urlFromDecoded = decoded.match(/https?:\/\/(?:www\.)?udemy\.com\/course\/[a-z0-9\-]+[^"'\s<>]*/i);
              if (urlFromDecoded) {
                const code = extractCouponCode(urlFromDecoded[0]);
                if (code && isValidCouponCode(code)) {
                  return { udemyUrl: urlFromDecoded[0], couponCode: code };
                }
              }
            }
          } catch { /* decode failed */ }
        }
      }
    } catch {
      // Strategy 3 failed
    }

    return null;
  } catch {
    return null;
  }
}

// ============================================
// UdemyFreebies Scraper - Detail Page
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
      signal: AbortSignal.timeout(5000),
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

// ============================================
// UdemyFreebies Scraper - Course Processing
// ============================================

async function processUdemyFreebiesCourse(
  course: ListingCourse,
  existingUrls: Set<string>,
  existingTitles: Set<string>,
  skipVerification: boolean = false,
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

    const baseUrl = normalizeUdemyUrl(udemyUrl);
    const couponUrl = udemyUrl;

    // --- DEDUP: already stored → skip, no DB write ---
    if (existingUrls.has(baseUrl)) {
      return { saved: false, skipped: 'duplicate-url' };
    }

    // --- NEW COURSE ---
    const couponExpiry = estimateCouponExpiry(couponCode);
    const pageIndex = course.pageIndex ?? 99;
    const doVerify = !skipVerification && shouldVerifyCoupon(pageIndex, couponCode);

    let couponVerified = false;
    let enrichment: UdemyCourseEnrichment | null = null;

    if (doVerify) {
      console.log(`[Scraper] Verifying & enriching from Udemy for "${course.title.substring(0, 40)}" (page ${pageIndex + 1})...`);
      const veResult = await verifyAndEnrichFromUdemy(couponUrl);

      if (veResult.verified) {
        couponVerified = veResult.isFree;
        if (!veResult.isFree) {
          console.log(`[Scraper] Coupon verified as NOT FREE for "${course.title.substring(0, 40)}" - skipping`);
          return { saved: false, skipped: 'expired-coupon' };
        }
        console.log(`[Scraper] Coupon verified as FREE for "${course.title.substring(0, 40)}" ✓`);
      } else {
        // Verification inconclusive (likely Cloudflare blocking) — trust the coupon
        // UdemyFreebies ONLY lists free coupon courses, so if we can't verify,
        // it's better to trust the coupon than to mark it as invalid.
        console.log(`[Scraper] Coupon verification inconclusive for "${course.title.substring(0, 40)}" - trusting coupon (UdemyFreebies is a free-coupon-only source)`);
        couponVerified = true;
      }

      enrichment = veResult.enrichment;
    } else {
      // Skip verification entirely — trust the coupon from UdemyFreebies
      couponVerified = true;
    }

    const courseData: ScrapedCourseData = {
      title: course.title,
      description: '',
      instructor: course.instructor,
      category: course.category,
      imageUrl: course.imageUrl,
      udemyUrl: baseUrl,
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

    if (enrichment) {
      // Use Udemy enrichment data for richer course details
      if (enrichment.description) {
        courseData.description = enrichment.description;
      } else {
        courseData.description = `Learn ${course.title} with this comprehensive free course. Covers ${course.category} skills and real-world applications.`;
      }
      courseData.requirements = enrichment.requirements;
      courseData.whoFor = enrichment.whoFor;
      courseData.whatLearn = enrichment.whatLearn;
      if (enrichment.duration) courseData.duration = enrichment.duration;
      if (enrichment.lastUpdated) courseData.lastUpdated = enrichment.lastUpdated;
      if (enrichment.instructor) courseData.instructor = enrichment.instructor;
      if (enrichment.rating !== null) courseData.rating = enrichment.rating;
      if (enrichment.studentsCount !== null) courseData.studentsCount = enrichment.studentsCount;
      if (enrichment.language) courseData.language = enrichment.language;
      if (enrichment.originalPrice) courseData.originalPrice = enrichment.originalPrice;
    } else {
      // Fall back to scraping the listing source's detail page
      try {
        const detailData = await scrapeDetailPage(course.detailUrl);
        if (detailData.description) {
          courseData.description = detailData.description;
        } else {
          courseData.description = `Learn ${course.title} with this comprehensive free course. Covers ${course.category} skills and real-world applications.`;
        }
        courseData.requirements = detailData.requirements;
        courseData.whoFor = detailData.whoFor;
        if (detailData.duration) courseData.duration = detailData.duration;
        if (detailData.lastUpdated) courseData.lastUpdated = detailData.lastUpdated;
      } catch {
        courseData.description = `Learn ${course.title} with this comprehensive free course. Covers ${course.category} skills and real-world applications.`;
      }
    }

    return await saveScrapedCourse(courseData, existingUrls, existingTitles);
  } catch (err) {
    console.error(`[Scraper] Error processing "${course.title.substring(0, 40)}":`, err);
    return { saved: false, skipped: 'error' };
  }
}

// ============================================
// UdemyFreebies Scraper - Main Function
// ============================================

async function scrapeUdemyFreebies(maxPages: number = 5, skipVerification: boolean = false): Promise<SourceResult> {
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
      fetchUdemyFreebiesListingPage(i + 1).catch(err => {
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

    const BATCH_SIZE = 5;
    for (let i = 0; i < allListedCourses.length; i += BATCH_SIZE) {
      const batch = allListedCourses.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(allListedCourses.length / BATCH_SIZE);

      const batchResults: PromiseSettledResult<{ saved: boolean; updated?: boolean; skipped?: string; data?: ScrapedCourseData }>[] = [];

      for (const course of batch) {
        const result = await processUdemyFreebiesCourse(course, existingUrls, existingTitles, skipVerification);
        batchResults.push({ status: 'fulfilled', value: result });
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
    message: `${maxPages} pages → ${newCount} new, ${updatedCount} updated, ${dupCount} duplicates, ${expiredCount} no valid coupon, ${errCount} errors`,
    duration,
    courses: allCourses,
  };
}

// ============================================
// StudyBullet Scraper
// ============================================

interface StudyBulletListing {
  title: string;
  detailUrl: string;
  imageUrl: string;
  slug: string;
}

/**
 * Extract course listings from a StudyBullet listing page.
 * StudyBullet uses a WordPress structure with courses in <article> blocks.
 */
function extractStudyBulletListings(html: string): StudyBulletListing[] {
  const $ = cheerio.load(html);
  const listings: StudyBulletListing[] = [];

  $('article').each((_, el) => {
    const $article = $(el);

    // Course link is in h2 > a or h3 > a, or any link containing /course/
    const $link = $article.find('h2 a, h3 a').first();
    const href = $link.attr('href') || $article.find('a[href*="/course/"]').first().attr('href') || '';

    // Only include course links (not category links, tag links, etc.)
    if (!href.includes('/course/') || href.includes('/course/category/')) return;

    const title = $link.text().trim();
    if (!title || title.length < 5) return;

    // Image from the article — handle lazy-loaded WordPress images
    const imageUrl = extractLazyImageFromElement($article.find('img').first());

    // Extract slug from URL
    const slugMatch = href.match(/\/course\/([^/]+)\/?$/);
    const slug = slugMatch ? slugMatch[1] : '';

    const detailUrl = href.startsWith('http') ? href : `https://studybullet.com${href}`;

    listings.push({ title, detailUrl, imageUrl, slug });
  });

  return listings;
}

/**
 * Fetch a StudyBullet listing page and extract course listings.
 */
async function fetchStudyBulletListingPage(pageNum: number): Promise<{ listings: StudyBulletListing[]; hasMore: boolean }> {
  const url = pageNum === 1
    ? 'https://studybullet.com/'
    : `https://studybullet.com/page/${pageNum}/`;

  const response = await fetch(url, {
    headers: getRandomHeaders(),
    signal: AbortSignal.timeout(15000),
    redirect: 'follow',
  });

  if (!response.ok) {
    if (response.status === 404) return { listings: [], hasMore: false };
    throw new Error(`HTTP ${response.status} for StudyBullet page ${pageNum}`);
  }

  const html = await response.text();
  const listings = extractStudyBulletListings(html);

  // Check for next page link
  const $ = cheerio.load(html);
  const hasNextPage = $('a.next, a[rel="next"], .nav-links .next, .pagination .next').length > 0;
  // Also check for page/N+1 link pattern
  const nextPageLink = $(`a[href*="/page/${pageNum + 1}/"]`).length > 0;
  const hasMore = listings.length > 0 && (hasNextPage || nextPageLink);

  return { listings, hasMore };
}

/**
 * Classify a StudyBullet section heading by its text.
 * StudyBullet repost pages use INCONSISTENT markup: sometimes <h2..h5>,
 * sometimes <b>/<strong> for the same section labels. This maps a heading
 * label to a known content bucket. Verified live against multiple pages.
 */
function classifyStudyBulletHeading(raw: string): 'desc' | 'req' | 'wl' | 'benefit' | 'stop' | null {
  const t = raw.toLowerCase().trim();
  if (/^(course overview|overview|about this course|course description)\b/.test(t)) return 'desc';
  if (/^(requirements?\s*\/?\s*prerequisites?|prerequisites?(?:\s+for\s+success)?|requirements?)\s*:?\s*$/.test(t)) return 'req';
  if (/^(skills?\s+covered.*|what\s+you.*learn.*|tools?\s+used.*|developing\s+your\s+skills.*|learning\s+objectives.*|you\s+will\s+learn.*)$/.test(t)) return 'wl';
  if (/^(benefits?.*|outcomes?.*|career\s+benefits.*)$/.test(t)) return 'benefit';
  if (/^(the\s+pros\b.*|the\s+cons\b.*|pros\b.*|cons\b.*|follow this video.*|learning tracks.*|add-on information.*)$/.test(t)) return 'stop';
  return null;
}

/** Normalize StudyBullet text: strip stray HTML rendered as text, collapse whitespace. */
function cleanStudyBulletText(t: string): string {
  return t
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract description / what-you'll-learn / requirements from a StudyBullet
 * `.entry-content` block. Treats both real heading tags AND bold tags that
 * match known section labels as section delimiters, then slices the content
 * between them. Verified live: produces full (1000-2000 char) clean text
 * across pages that use <h3> headings AND pages that use <b> headings.
 */
function extractStudyBulletContent($: cheerio.CheerioAPI): {
  description: string;
  whatLearn: string;
  requirements: string;
} {
  const $ec = $('.entry-content').first();
  if ($ec.length === 0) return { description: '', whatLearn: '', requirements: '' };

  // Drop non-content noise before reading text.
  $ec.find('script, style, ins, .adsbygoogle, iframe').remove();

  // Replace each section heading with an inline marker so we can split the
  // flattened text into ordered sections regardless of the heading tag used.
  $ec.find('h2, h3, h4, h5, b, strong').each((_, el) => {
    const text = cleanStudyBulletText($(el).text());
    if (!text || text.length > 70) return;
    let kind = classifyStudyBulletHeading(text);
    const tag = (el as { tagName?: string }).tagName?.toLowerCase() || '';
    if (kind === null) {
      // Real heading tags with an unknown label are treated as the narrative
      // overview (some pages give the description an arbitrary <h4> title).
      if (tag[0] === 'h') kind = 'desc';
      else return; // a plain inline <b>/<strong> emphasis, not a section
    }
    $(el).replaceWith(`||SBSEC:${kind}||`);
  });

  const text = cleanStudyBulletText($ec.text());
  const parts = text.split(/\|\|SBSEC:(desc|req|wl|benefit|stop)\|\|/);

  const sec: Record<string, string[]> = { desc: [], req: [], wl: [], benefit: [] };
  const junkTail = /\b(Found It Free.*|Share It Fast.*|Follow this Video.*|Get Instant Notification.*|Enroll for Free.*|WhatsApp\s+Facebook.*)$/i;
  for (let i = 1; i < parts.length; i += 2) {
    const kind = parts[i];
    if (kind === 'stop') continue;
    let body = (parts[i + 1] || '').replace(junkTail, '').trim();
    if (body.length > 15 && sec[kind]) sec[kind].push(body);
  }

  let description = (sec.desc[0] || '').slice(0, 2000);
  if (description.length < 60) {
    const preamble = (parts[0] || '').replace(/^.*?Add-On Information\s*:?\s*/i, '').trim();
    if (preamble.length > 60) description = preamble.slice(0, 2000);
  }
  const whatLearn = [...sec.wl, ...sec.benefit].join(' • ').slice(0, 1800);
  const requirements = sec.req.join(' • ').slice(0, 1000);

  return { description, whatLearn, requirements };
}

/**
 * Extract course details from a StudyBullet detail page.
 * This is the critical function — the detail page contains:
 * - ZapUrl with the full Udemy URL + coupon code
 * - Coupon code as text
 * - Course metadata (rating, students, duration, instructor, last updated)
 */
async function extractStudyBulletDetail(detailUrl: string): Promise<{
  udemyUrl: string;
  couponCode: string;
  title: string;
  imageUrl: string;
  rating: number | null;
  studentsCount: number | null;
  duration: string | null;
  instructor: string;
  lastUpdated: string | null;
  description: string;
  whatLearn: string;
  requirements: string;
} | null> {
  try {
    const response = await fetch(detailUrl, {
      headers: getRandomHeaders(),
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    });

    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    // Decode HTML entities (e.g., &amp; → &)
    const decodedHtml = html
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, ' ');

    // 1. Find ZapUrl parameter in enroll links — this contains the FULL Udemy URL with coupon
    const zapUrlMatch = decodedHtml.match(/ZapUrl=([^&"'>\s]+)/);
    let udemyUrl = '';
    let couponCode = '';

    if (zapUrlMatch) {
      // Decode the URL (it may be URL-encoded)
      try {
        udemyUrl = decodeURIComponent(zapUrlMatch[1]);
      } catch {
        udemyUrl = zapUrlMatch[1];
      }

      // Extract coupon code from the Udemy URL
      couponCode = extractCouponCode(udemyUrl);
    }

    // 2. If no ZapUrl found, try to find coupon code from text + construct URL
    if (!couponCode) {
      const couponTextMatch = decodedHtml.match(/Apply Coupon Code[➛>]+([A-Za-z0-9]{4,})/);
      if (couponTextMatch) {
        couponCode = couponTextMatch[1];

        // Try to find a Udemy course URL in the page to pair with the coupon
        const udemyCourseMatch = decodedHtml.match(/https?:\/\/(?:www\.)?udemy\.com\/course\/[a-z0-9\-]+/i);
        if (udemyCourseMatch) {
          udemyUrl = `${udemyCourseMatch[0]}?couponCode=${couponCode}`;
        }
      }
    }

    // 3. NEW: StudyBullet now embeds Udemy URLs directly in enroll buttons
    // Pattern: <a class="enroll_btn" href="https://www.udemy.com/course/.../?couponCode=CODE">
    // Also covers generic <a href="...udemy.com/course/...?couponCode=..."> patterns
    if (!couponCode) {
      // 3a: Look for enroll button with direct Udemy URL + coupon
      const enrollMatch = decodedHtml.match(/href=["'](https?:\/\/(?:www\.)?udemy\.com\/course\/[a-z0-9\-]+\/?(?:\?[^"']*?(?:couponCode|coupon)=([A-Za-z0-9_\-]+)[^"']*)?)["']/i);
      if (enrollMatch) {
        udemyUrl = enrollMatch[1];
        couponCode = extractCouponCode(udemyUrl);
      }
    }

    // 3b: Broader scan — find ANY Udemy URL with couponCode in the entire page
    if (!couponCode || !udemyUrl) {
      const allUdemyUrls = decodedHtml.matchAll(/https?:\/\/(?:www\.)?udemy\.com\/course\/[a-z0-9\-]+\/?(?:\?[^"'\s<>]*?(?:couponCode|coupon)=([A-Za-z0-9_\-]+)[^"'\s<>]*)?/gi);
      for (const m of allUdemyUrls) {
        const url = m[0];
        const code = m[1] || extractCouponCode(url);
        if (code && isValidCouponCode(code)) {
          udemyUrl = url;
          couponCode = code;
          break;
        }
      }
    }

    // 3c: Find coupon code displayed as text + separate Udemy URL anywhere on page
    if (!couponCode) {
      // Look for standalone coupon code patterns (e.g. "Coupon: XXXXXXX" or "Code: XXXXXXX")
      const textCouponPatterns = [
        /coupon\s*(?:code)?[:\s]+([A-Z0-9]{4,})/i,
        /code[:\s]+([A-Z0-9]{4,})/i,
        /(?:coupon|discount)\s*[:\s]*([A-Z0-9]{6,})/i,
      ];
      for (const pat of textCouponPatterns) {
        const tcMatch = decodedHtml.match(pat);
        if (tcMatch && isValidCouponCode(tcMatch[1])) {
          couponCode = tcMatch[1];
          // Try to find a Udemy URL on the page to pair with
          const udemyCourseMatch = decodedHtml.match(/https?:\/\/(?:www\.)?udemy\.com\/course\/[a-z0-9\-]+/i);
          if (udemyCourseMatch) {
            udemyUrl = `${udemyCourseMatch[0]}?couponCode=${couponCode}`;
          }
          break;
        }
      }
    }

    // Validate coupon code
    if (!couponCode || !isValidCouponCode(couponCode)) return null;
    if (!udemyUrl || !udemyUrl.includes('udemy.com')) return null;

    // 3. Extract title from the page
    const title = $('h1').first().text().trim() || $('h2').first().text().trim() || $('title').text().trim().replace(' - StudyBullet', '').trim();
    if (!title || title.length < 5) return null;

    // 4. Extract image — handle lazy loading properly
    // WordPress lazy-loaded images use base64 placeholder in src, real URL in data-src
    const imageUrl = enhanceImageUrl(
      extractLazyImage($, 'article img') ||
      extractLazyImage($, '.thumbnail img') ||
      extractLazyImage($, '.blog-entry img') ||
      extractLazyImage($, 'img') ||
      ''
    );

    // 5. Extract rating (only when StudyBullet actually shows one)
    let rating: number | null = null;
    const ratingMatch = decodedHtml.match(/([\d.]+)\s*\/\s*5\s*rating/i) || decodedHtml.match(/([\d.]+)\s*out of\s*5/i);
    if (ratingMatch) {
      const r = parseFloat(ratingMatch[1]);
      if (r > 0 && r <= 5) rating = r;
    }

    // 6. Extract student count
    let studentsCount: number | null = null;
    const studentsMatch = decodedHtml.match(/([\d,]+)\s*students/i);
    if (studentsMatch) {
      const n = parseInt(studentsMatch[1].replace(/,/g, ''));
      if (n > 0) studentsCount = n;
    }

    // 7. Extract duration
    let duration: string | null = null;
    const durationMatch = decodedHtml.match(/Length:\s*([\d.]+)\s*total hours/i);
    if (durationMatch) {
      duration = `${durationMatch[1]} hours`;
    }

    // 8. Instructor: StudyBullet only exposes the WordPress post author (the
    // re-poster), not the real Udemy instructor. Leaving it empty is more
    // accurate than scraping a misleading/garbage value. (The previous regex
    // matched the "Site Kit by Google" generator meta tag.)
    const instructor = '';

    // 9. Extract last updated
    let lastUpdated: string | null = null;
    const updateMatch = decodedHtml.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\s*update/i);
    if (updateMatch) {
      lastUpdated = updateMatch[1];
    }

    // 10. Extract description / what-you'll-learn / requirements from the
    // structured .entry-content sections (verified live across page variants).
    const content = extractStudyBulletContent($);
    const description = content.description;
    const whatLearnFromPage = content.whatLearn;
    const requirementsFromPage = content.requirements;

    return {
      udemyUrl,
      couponCode,
      title,
      imageUrl,
      rating,
      studentsCount,
      duration,
      instructor,
      lastUpdated,
      description,
      whatLearn: whatLearnFromPage,
      requirements: requirementsFromPage,
    };
  } catch {
    return null;
  }
}

/**
 * Process a single StudyBullet listing: fetch detail page, extract coupon data, verify, and save.
 */
async function processStudyBulletCourse(
  listing: StudyBulletListing,
  existingUrls: Set<string>,
  existingTitles: Set<string>,
  pageIndex: number,
  skipVerification: boolean = false,
): Promise<{ saved: boolean; updated?: boolean; skipped?: string; data?: ScrapedCourseData }> {
  try {
    const normTitle = normalizeTitle(listing.title);
    if (existingTitles.has(normTitle)) {
      return { saved: false, skipped: 'duplicate-title' };
    }

    // Fetch detail page to get Udemy URL + coupon
    const detail = await extractStudyBulletDetail(listing.detailUrl);
    if (!detail) {
      return { saved: false, skipped: 'no-valid-coupon' };
    }

    const { udemyUrl, couponCode } = detail;
    if (!isValidCouponCode(couponCode)) {
      return { saved: false, skipped: 'no-valid-coupon' };
    }

    const baseUrl = normalizeUdemyUrl(udemyUrl);
    const couponUrl = udemyUrl;

    // --- DEDUP: already stored → skip, no DB write ---
    if (existingUrls.has(baseUrl)) {
      return { saved: false, skipped: 'duplicate-url' };
    }

    // --- NEW COURSE ---
    const couponExpiry = estimateCouponExpiry(couponCode);
    const doVerify = !skipVerification && shouldVerifyCoupon(pageIndex, couponCode);

    let couponVerified = false;
    let enrichment: UdemyCourseEnrichment | null = null;

    if (doVerify) {
      console.log(`[Scraper/StudyBullet] Verifying & enriching from Udemy for "${detail.title.substring(0, 40)}" (page ${pageIndex + 1})...`);
      const veResult = await verifyAndEnrichFromUdemy(couponUrl);

      if (veResult.verified) {
        couponVerified = veResult.isFree;
        if (!veResult.isFree) {
          console.log(`[Scraper/StudyBullet] Coupon verified as NOT FREE for "${detail.title.substring(0, 40)}" - skipping`);
          return { saved: false, skipped: 'expired-coupon' };
        }
        console.log(`[Scraper/StudyBullet] Coupon verified as FREE for "${detail.title.substring(0, 40)}" ✓`);
      } else {
        // Verification inconclusive (likely Cloudflare blocking) — trust the coupon
        // StudyBullet ONLY lists free coupon courses, so if we can't verify,
        // it's better to trust the coupon than to mark it as invalid.
        console.log(`[Scraper/StudyBullet] Coupon verification inconclusive for "${detail.title.substring(0, 40)}" - trusting coupon (StudyBullet is a free-coupon-only source)`);
        couponVerified = true;
      }

      enrichment = veResult.enrichment;
    } else {
      // Skip verification entirely — trust the coupon from StudyBullet
      couponVerified = true;
    }

    const courseData: ScrapedCourseData = {
      title: detail.title,
      description: detail.description || `Learn ${detail.title} with this comprehensive free course. Covers ${categorize(detail.title)} skills and real-world applications.`,
      instructor: detail.instructor,
      category: categorize(detail.title),
      imageUrl: detail.imageUrl,
      udemyUrl: baseUrl,
      couponUrl,
      couponCode,
      couponExpiresAt: couponExpiry,
      isFreeForever: false,
      couponVerified,
      sourceDetail: 'studybullet',
      rating: detail.rating,
      studentsCount: detail.studentsCount,
      originalPrice: null,
      language: null,
      duration: detail.duration,
      requirements: detail.requirements || '',
      whoFor: '',
      whatLearn: detail.whatLearn || '',
      lastUpdated: detail.lastUpdated,
      source: 'studybullet',
    };

    if (enrichment) {
      // Use Udemy enrichment data for richer course details
      if (enrichment.description) courseData.description = enrichment.description;
      if (enrichment.requirements) courseData.requirements = enrichment.requirements;
      if (enrichment.whoFor) courseData.whoFor = enrichment.whoFor;
      if (enrichment.whatLearn) courseData.whatLearn = enrichment.whatLearn;
      if (enrichment.duration) courseData.duration = enrichment.duration;
      if (enrichment.lastUpdated) courseData.lastUpdated = enrichment.lastUpdated;
      if (enrichment.instructor) courseData.instructor = enrichment.instructor;
      if (enrichment.rating !== null) courseData.rating = enrichment.rating;
      if (enrichment.studentsCount !== null) courseData.studentsCount = enrichment.studentsCount;
      if (enrichment.language) courseData.language = enrichment.language;
      if (enrichment.originalPrice) courseData.originalPrice = enrichment.originalPrice;
    }

    return await saveScrapedCourse(courseData, existingUrls, existingTitles);
  } catch (err) {
    console.error(`[Scraper/StudyBullet] Error processing "${listing.title.substring(0, 40)}":`, err);
    return { saved: false, skipped: 'error' };
  }
}

/**
 * Main StudyBullet scraper function.
 * Scrapes listing pages, fetches detail pages for coupon extraction, verifies, and saves.
 */
async function scrapeStudyBullet(maxPages: number = 5, skipVerification: boolean = false): Promise<SourceResult> {
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
    console.log(`[Scraper/StudyBullet] Starting with ${existingCourses.length} existing courses in DB`);

    // Fetch listing pages sequentially (each page gives ~21 courses)
    console.log(`[Scraper/StudyBullet] Fetching up to ${maxPages} listing pages...`);
    const allListings: StudyBulletListing[] = [];
    const seenSlugs = new Set<string>();

    for (let page = 1; page <= maxPages; page++) {
      try {
        const result = await fetchStudyBulletListingPage(page);

        // Dedup listings by slug
        const newListings = result.listings.filter(l => {
          if (seenSlugs.has(l.slug)) return false;
          seenSlugs.add(l.slug);
          return true;
        });
        allListings.push(...newListings);

        console.log(`[Scraper/StudyBullet] Page ${page}: found ${newListings.length} listings (total: ${allListings.length})`);

        if (!result.hasMore || newListings.length === 0) {
          console.log(`[Scraper/StudyBullet] No more pages, stopping at page ${page}`);
          break;
        }

        // Delay between page fetches
        if (page < maxPages) {
          await new Promise(r => setTimeout(r, 300));
        }
      } catch (err) {
        errors.push(`Page ${page}: ${err}`);
        console.error(`[Scraper/StudyBullet] Error fetching page ${page}:`, err);
        // Continue to next page
      }
    }

    console.log(`[Scraper/StudyBullet] Found ${allListings.length} total listings, processing detail pages...`);

    // Process each course: fetch detail page, extract coupon, verify, save
    for (let i = 0; i < allListings.length; i++) {
      const listing = allListings[i];
      const batchNum = Math.floor(i / 5) + 1;

      try {
        const result = await processStudyBulletCourse(listing, existingUrls, existingTitles, Math.floor(i / 21), skipVerification);

        if (result.saved) {
          newCount++;
          allCourses.push(result.data!);
        } else if (result.updated) {
          updatedCount++;
        } else if (result.skipped === 'duplicate-title' || result.skipped === 'duplicate-url' || result.skipped === 'db-duplicate') {
          dupCount++;
        } else if (result.skipped === 'no-valid-coupon' || result.skipped === 'expired-coupon') {
          expiredCount++;
        } else {
          errCount++;
        }
      } catch (err) {
        errCount++;
        console.error(`[Scraper/StudyBullet] Error processing "${listing.title.substring(0, 40)}":`, err);
      }

      if ((i + 1) % 5 === 0) {
        console.log(`[Scraper/StudyBullet] Processed ${i + 1}/${allListings.length}: ${newCount} new, ${updatedCount} updated, ${dupCount} dup, ${expiredCount} no-coupon/expired, ${errCount} err`);
      }

      // Rate limit between detail page fetches (200-300ms)
      await new Promise(r => setTimeout(r, 200 + Math.random() * 100));
    }
  } catch (err) {
    errors.push(`Fatal: ${err}`);
    errCount++;
  }

  const duration = Date.now() - start;
  const status = newCount > 0 ? 'success' : (errCount > 0 ? 'error' : 'partial');

  console.log(`[Scraper/StudyBullet] Done in ${(duration / 1000).toFixed(1)}s: ${newCount} new, ${updatedCount} updated, ${dupCount} dup, ${expiredCount} no-coupon/expired, ${errCount} err`);

  const logEntry: ScraperLogEntry = {
    source: 'studybullet',
    status,
    newCount,
    dupCount,
    errCount,
    message: `${newCount} new, ${updatedCount} updated from ${maxPages} pages, ${dupCount} dup, ${expiredCount} no-valid-coupon, ${errCount} err`,
    duration,
  };
  await logScraperRun(logEntry).catch(() => {});

  return {
    source: 'studybullet',
    status,
    newCount,
    dupCount,
    errCount,
    expiredCount,
    updatedCount,
    message: `${maxPages} pages → ${newCount} new, ${updatedCount} updated, ${dupCount} duplicates, ${expiredCount} no valid coupon, ${errCount} errors`,
    duration,
    courses: allCourses,
  };
}

// ============================================
// Cleanup Duplicates (Title-based dedup)
// ============================================

export async function cleanupDuplicates(): Promise<{ removed: number }> {
  const allCourses = await db.course.findMany({
    select: { id: true, title: true },
  });

  const seenTitles = new Map<string, string>();
  const duplicateIds: string[] = [];

  for (const course of allCourses) {
    const norm = course.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seenTitles.has(norm)) {
      duplicateIds.push(course.id);
    } else {
      seenTitles.set(norm, course.id);
    }
  }

  if (duplicateIds.length === 0) {
    return { removed: 0 };
  }

  const result = await db.course.deleteMany({
    where: { id: { in: duplicateIds } },
  });

  console.log(`[Scraper/Cleanup] Removed ${result.count} duplicate courses by title`);
  return { removed: result.count };
}

// ============================================
// Run Full Scrape (UdemyFreebies + StudyBullet)
// ============================================

function makeEmptySourceResult(source: string): SourceResult {
  return {
    source,
    status: 'partial',
    newCount: 0,
    dupCount: 0,
    errCount: 0,
    expiredCount: 0,
    updatedCount: 0,
    message: 'This source is not enabled',
    duration: 0,
    courses: [],
  };
}

/**
 * Run a full scrape across all enabled sources.
 * Supports two call signatures for backward compatibility:
 *   - runFullScrape(sources?: string[])          — legacy array-only form
 *   - runFullScrape(options?: { pages?, sources? }) — preferred object form
 *
 * After scraping all sources, runs:
 *   1. Post-scrape verification sweep on newly added courses
 *   2. cleanupInvalidCourses() — removes bad coupon codes, fake free-forever, duplicates
 *   3. cleanupDuplicates() — title-based dedup
 *   4. removeOldExpiredCourses() — removes courses with coupons expired >7 days ago
 */
export async function runFullScrape(
  arg?: string[] | { pages?: number; sources?: string[]; skipVerification?: boolean; skipCleanup?: boolean }
): Promise<ScrapeResult> {
  // Normalize arguments: handle both call signatures
  const rawOpts = typeof arg === 'object' && !Array.isArray(arg) ? arg : { sources: Array.isArray(arg) ? arg : undefined };
  const opts = {
    pages: rawOpts.pages ?? 5,
    sources: rawOpts.sources,
    skipVerification: rawOpts.skipVerification ?? false,
    skipCleanup: rawOpts.skipCleanup ?? false,
  };

  const pages = Math.min(Math.max(opts.pages, 1), 20);

  // Fresh Cloudflare circuit state per run.
  resetUdemyCircuit();

  console.log(`[Scraper] Starting full scrape: ${pages} pages, sources: ${opts.sources?.join(', ') || 'all'}, skipVerification: ${opts.skipVerification}, skipCleanup: ${opts.skipCleanup}`);

  let udemyfreebiesResult: SourceResult = makeEmptySourceResult('udemyfreebies');
  let studybulletResult: SourceResult = makeEmptySourceResult('studybullet');
  const totalStart = Date.now();

  // Determine which sources to run
  const shouldRunUdemyFreebies = !opts.sources || opts.sources.includes('udemyfreebies');
  const shouldRunStudyBullet = !opts.sources || opts.sources.includes('studybullet');

  // --- Source 1: UdemyFreebies ---
  if (shouldRunUdemyFreebies) {
    try {
      udemyfreebiesResult = await scrapeUdemyFreebies(pages, opts.skipVerification);
    } catch (err) {
      console.error('[Scraper] UdemyFreebies scrape failed:', err);
      udemyfreebiesResult = {
        source: 'udemyfreebies',
        status: 'error',
        newCount: 0,
        dupCount: 0,
        errCount: 1,
        expiredCount: 0,
        updatedCount: 0,
        message: `Scraper failed: ${String(err)}`,
        duration: Date.now() - totalStart,
        courses: [],
      };
    }
  }

  // --- Source 2: StudyBullet ---
  if (shouldRunStudyBullet) {
    try {
      studybulletResult = await scrapeStudyBullet(pages, opts.skipVerification);
    } catch (err) {
      console.error('[Scraper] StudyBullet scrape failed:', err);
      studybulletResult = {
        source: 'studybullet',
        status: 'error',
        newCount: 0,
        dupCount: 0,
        errCount: 1,
        expiredCount: 0,
        updatedCount: 0,
        message: `Scraper failed: ${String(err)}`,
        duration: Date.now() - totalStart,
        courses: [],
      };
    }
  }

  // ============================================
  // Post-Scrape Cleanup & Verification
  // Skip when called from Vercel serverless (60s timeout) — cleanup runs separately via cron
  // ============================================

  if (!opts.skipCleanup) {
    const allNewCourses = [
      ...udemyfreebiesResult.courses,
      ...studybulletResult.courses,
    ];

    // 1. Post-scrape verification sweep: re-verify newly added courses
    if (!opts.skipVerification && allNewCourses.length > 0) {
      try {
        console.log(`[Scraper] Running post-scrape verification sweep on ${allNewCourses.length} newly added courses...`);
        await postScrapeVerificationSweep(allNewCourses);
      } catch (err) {
        console.error('[Scraper] Post-scrape verification sweep failed:', err);
      }
    }

    // 2. Cleanup invalid courses (bad coupons, fake free-forever, duplicates)
    try {
      console.log(`[Scraper] Running cleanupInvalidCourses()...`);
      const cleanupResult = await cleanupInvalidCourses();
      console.log(`[Scraper] Cleanup removed ${cleanupResult.totalRemoved} invalid courses`);
    } catch (err) {
      console.error('[Scraper] cleanupInvalidCourses failed:', err);
    }

    // 3. Cleanup title-based duplicates
    try {
      console.log(`[Scraper] Running cleanupDuplicates()...`);
      const dupResult = await cleanupDuplicates();
      console.log(`[Scraper] Duplicate cleanup removed ${dupResult.removed} courses`);
    } catch (err) {
      console.error('[Scraper] cleanupDuplicates failed:', err);
    }

    // 4. Remove courses older than 7 days with expired coupons
    try {
      console.log(`[Scraper] Removing old expired courses (>7 days)...`);
      const oldResult = await removeOldExpiredCourses();
      console.log(`[Scraper] Removed ${oldResult.removed} old expired courses`);
    } catch (err) {
      console.error('[Scraper] removeOldExpiredCourses failed:', err);
    }
  } else {
    console.log(`[Scraper] Skipping post-scrape cleanup (skipCleanup=true)`);
  }

  // ============================================
  // Final Results
  // ============================================

  const totalDuration = Date.now() - totalStart;

  const totalNew = udemyfreebiesResult.newCount + studybulletResult.newCount;
  const totalDup = udemyfreebiesResult.dupCount + studybulletResult.dupCount;
  const totalErr = udemyfreebiesResult.errCount + studybulletResult.errCount;

  console.log(`[Scraper] Full scrape complete in ${(totalDuration / 1000).toFixed(1)}s: ${totalNew} new, ${totalDup} dup, ${totalErr} err`);

  return {
    totalNew,
    totalDup,
    totalErr,
    totalDuration,
    udemyfreebies: udemyfreebiesResult,
    studybullet: studybulletResult,
  };
}

// ============================================
// Single source/page scrape (batched scraping)
// ============================================

export type ScrapeSource = 'udemyfreebies' | 'studybullet';

export interface SourcePageItem {
  /** Stable canonical identity of the listing item (source detail URL). */
  canonicalUrl: string;
  title: string;
}

export interface SourcePageResult {
  source: ScrapeSource;
  page: number;
  success: boolean;
  parsedCount: number;
  /** Parsed listing items in page order (used to compute head fingerprints). */
  items: SourcePageItem[];
  stats: {
    newCount: number;
    dupCount: number;
    updatedCount: number;
    reactivatedCount: number;
    expiredCount: number;
    errCount: number;
    durationMs: number;
  };
}

/**
 * Scrape exactly ONE source and ONE page (pages: 1). This is the bounded
 * building block behind /api/cron/scrape-batch: it fetches a single listing
 * page, parses its items, then processes them with the existing per-course
 * pipeline. Verification and post-scrape cleanup are skipped by default so a
 * single request stays well under the serverless timeout.
 *
 * Note: reactivatedCount is always 0 — the per-course pipeline does not
 * distinguish reactivation from update. It is reported (and treated by the
 * early-stop logic) for forward compatibility and to stay conservative.
 */
export async function scrapeSourcePage(
  source: ScrapeSource,
  page: number,
  options: { skipVerification?: boolean; skipCleanup?: boolean } = {},
): Promise<SourcePageResult> {
  const start = Date.now();
  const skipVerification = options.skipVerification ?? true;

  let newCount = 0;
  let dupCount = 0;
  let updatedCount = 0;
  const reactivatedCount = 0;
  let expiredCount = 0;
  let errCount = 0;
  let success = true;
  const items: SourcePageItem[] = [];

  // Fresh Cloudflare circuit state per request.
  resetUdemyCircuit();

  const tally = (result: { saved: boolean; updated?: boolean; skipped?: string }) => {
    if (result.saved) {
      newCount++;
    } else if (result.updated) {
      updatedCount++;
    } else if (
      result.skipped === 'duplicate-title' ||
      result.skipped === 'duplicate-url' ||
      result.skipped === 'db-duplicate'
    ) {
      dupCount++;
    } else if (result.skipped === 'no-valid-coupon' || result.skipped === 'expired-coupon') {
      expiredCount++;
    } else {
      errCount++;
    }
  };

  try {
    const existingCourses = await db.course.findMany({
      select: { udemyUrl: true, title: true },
    });
    const existingUrls = new Set(existingCourses.map((c) => normalizeUdemyUrl(c.udemyUrl)));
    const existingTitles = new Set(existingCourses.map((c) => normalizeTitle(c.title)));

    if (source === 'udemyfreebies') {
      const { courses } = await fetchUdemyFreebiesListingPage(page);
      for (const course of courses) {
        items.push({ canonicalUrl: course.detailUrl, title: course.title });
      }
      for (const course of courses) {
        try {
          const result = await processUdemyFreebiesCourse(
            course,
            existingUrls,
            existingTitles,
            skipVerification,
          );
          tally(result);
        } catch (err) {
          errCount++;
          console.error(`[Scraper/Batch] udemyfreebies p${page} error:`, err);
        }
      }
    } else {
      const { listings } = await fetchStudyBulletListingPage(page);
      for (const listing of listings) {
        items.push({ canonicalUrl: listing.detailUrl || listing.slug, title: listing.title });
      }
      for (const listing of listings) {
        try {
          const result = await processStudyBulletCourse(
            listing,
            existingUrls,
            existingTitles,
            0,
            skipVerification,
          );
          tally(result);
          // Light rate limit between detail fetches (matches full scraper).
          await new Promise((r) => setTimeout(r, 200 + Math.random() * 100));
        } catch (err) {
          errCount++;
          console.error(`[Scraper/Batch] studybullet p${page} error:`, err);
        }
      }
    }
  } catch (err) {
    // Listing fetch failed entirely — uncertain, never an early-stop candidate.
    success = false;
    errCount++;
    console.error(`[Scraper/Batch] ${source} p${page} listing fetch failed:`, err);
  }

  const durationMs = Date.now() - start;
  console.log(
    `[Scraper/Batch] ${source} p${page}: parsed=${items.length} new=${newCount} dup=${dupCount} updated=${updatedCount} expired=${expiredCount} err=${errCount} in ${(durationMs / 1000).toFixed(1)}s`,
  );

  return {
    source,
    page,
    success,
    parsedCount: items.length,
    items,
    stats: {
      newCount,
      dupCount,
      updatedCount,
      reactivatedCount,
      expiredCount,
      errCount,
      durationMs,
    },
  };
}
