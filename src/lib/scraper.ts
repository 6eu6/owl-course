import * as cheerio from 'cheerio';
import { COLLECTIONS, type Course } from './types';
import { getCollection } from './mongodb';

interface ScrapedCourse {
  title: string;
  url: string;
  image_url: string;
  description?: string;
  instructor?: string;
  category?: string;
  rating?: string;
  students?: string;
  price?: string;
  language?: string;
  duration?: string;
}

// Generate slug from title
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .slice(0, 120) || 'course';
}

// Ensure unique slug
async function ensureUniqueSlug(slug: string, collection: Awaited<ReturnType<typeof getCollection>>): Promise<string> {
  let finalSlug = slug;
  let counter = 1;
  while (await collection.findOne({ slug: finalSlug })) {
    finalSlug = `${slug}-${counter}`;
    counter++;
  }
  return finalSlug;
}

// Categorize based on title keywords
function categorize(title: string, description: string = ''): string {
  const text = `${title} ${description}`.toLowerCase();
  const categories: Record<string, string[]> = {
    'Web Development': ['web', 'html', 'css', 'javascript', 'react', 'angular', 'vue', 'node', 'frontend', 'backend', 'full stack', 'wordpress', 'php', 'django', 'flask', 'laravel'],
    'Mobile Development': ['mobile', 'android', 'ios', 'flutter', 'react native', 'swift', 'kotlin', 'app development'],
    'Data Science': ['data science', 'machine learning', 'deep learning', 'ai', 'artificial intelligence', 'nlp', 'neural', 'tensorflow', 'pytorch'],
    'Python': ['python', 'django', 'flask', 'pandas', 'numpy', 'matplotlib', 'scipy'],
    'Cloud & DevOps': ['cloud', 'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'devops', 'terraform', 'ci/cd'],
    'Cybersecurity': ['security', 'cybersecurity', 'ethical hacking', 'penetration', 'network security', 'infosec'],
    'Design': ['design', 'graphic', 'ui/ux', 'ux', 'figma', 'photoshop', 'illustrator', 'adobe'],
    'Marketing': ['marketing', 'seo', 'sem', 'social media marketing', 'digital marketing', 'google ads', 'facebook ads'],
    'Business': ['business', 'management', 'project management', 'entrepreneurship', 'finance', 'accounting', 'excel'],
    'IT & Software': ['it', 'software', 'comptia', 'linux', 'git', 'database', 'sql', 'oracle', 'networking'],
    'Photography': ['photography', 'photo', 'camera', 'video', 'video editing', 'premiere', 'after effects', 'filmora'],
    'Personal Development': ['personal development', 'productivity', 'communication', 'leadership', 'motivation', 'mindset'],
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(k => text.includes(k))) {
      return category;
    }
  }
  return 'Other';
}

// ============================================
// UdemyFreebies Scraper
// ============================================
export async function scrapeUdemyFreebies(maxPages: number = 5): Promise<{ added: number; processed: number; errors: string[] }> {
  const errors: string[] = [];
  let totalAdded = 0;
  let totalProcessed = 0;

  const coursesCol = await getCollection(COLLECTIONS.COURSES);

  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = `https://www.udemyfreebies.com/page/${page}/`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        if (response.status === 404) break; // No more pages
        errors.push(`Page ${page}: HTTP ${response.status}`);
        continue;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const courseLinks: { title: string; url: string; image: string }[] = [];

      $('.entry-content a, .post-content a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const title = $(el).text().trim();
        if (href.includes('udemy.com') && title.length > 5) {
          const img = $(el).find('img').attr('src') || $(el).closest('article, .post').find('img').attr('src') || '';
          courseLinks.push({ title, url: href, image: img });
        }
      });

      // Also try to extract from common patterns
      $('article a, .post a').each((_, el) => {
        const href = $(el).attr('href') || '';
        const title = $(el).text().trim() || $(el).find('img').attr('alt') || '';
        if (href.includes('udemy.com') && title.length > 10 && !courseLinks.find(c => c.url === href)) {
          const img = $(el).find('img').attr('src') || '';
          courseLinks.push({ title, url: href, image: img });
        }
      });

      for (const link of courseLinks) {
        totalProcessed++;
        try {
          // Check if already exists
          const exists = await coursesCol.findOne({ udemy_url: link.url });
          if (exists) continue;

          // Get default Udemy image if no image found
          const imageUrl = link.image || `https://img-b.udemycdn.com/course/480x270/placeholder.jpg`;

          const slug = await ensureUniqueSlug(slugify(link.title), coursesCol);

          const course: Omit<Course, '_id'> = {
            title: link.title,
            slug,
            description: '',
            instructor: '',
            category: categorize(link.title),
            image_url: imageUrl,
            udemy_url: link.url,
            source: 'udemyfreebies',
            is_published: true,
            telegram_posted: false,
            scraped_at: new Date(),
            created_at: new Date(),
            updated_at: new Date(),
          };

          await coursesCol.insertOne(course);
          totalAdded++;
        } catch (err) {
          errors.push(`Course "${link.title}": ${err}`);
        }
      }

      if (courseLinks.length === 0) break; // Stop if no courses found

    } catch (err) {
      errors.push(`Page ${page}: ${err}`);
    }
  }

  return { added: totalAdded, processed: totalProcessed, errors };
}

// ============================================
// StudyBullet Scraper
// ============================================
export async function scrapeStudyBullet(maxPages: number = 5): Promise<{ added: number; processed: number; errors: string[] }> {
  const errors: string[] = [];
  let totalAdded = 0;
  let totalProcessed = 0;

  const coursesCol = await getCollection(COLLECTIONS.COURSES);

  for (let page = 1; page <= maxPages; page++) {
    try {
      const url = `https://studybullet.com/category/free-courses/page/${page}/`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        if (response.status === 404) break;
        errors.push(`StudyBullet page ${page}: HTTP ${response.status}`);
        continue;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      $('article, .post, .entry').each((_, el) => {
        const titleEl = $(el).find('h2 a, h3 a, .entry-title a');
        const title = titleEl.text().trim();
        const courseUrl = titleEl.attr('href') || '';
        const imgEl = $(el).find('img');
        const imageUrl = imgEl.attr('src') || imgEl.data('src') || imgEl.attr('data-lazy-src') || '';

        if (title.length > 5) {
          totalProcessed++;
          // We'll process asynchronously below
        }
      });

      // Extract courses
      const courses: ScrapedCourse[] = [];
      $('article, .post, .entry').each((_, el) => {
        const titleEl = $(el).find('h2 a, h3 a, .entry-title a');
        const title = titleEl.text().trim();
        const courseUrl = titleEl.attr('href') || '';
        const imgEl = $(el).find('img');
        const imageUrl = imgEl.attr('src') || imgEl.data('src') || imgEl.attr('data-lazy-src') || '';
        const descEl = $(el).find('.entry-content, .entry-summary, .post-content');
        const description = descEl.text().trim().slice(0, 500);

        if (title.length > 5 && courseUrl) {
          courses.push({ title, url: courseUrl, image_url: imageUrl, description });
        }
      });

      for (const course of courses) {
        try {
          const exists = await coursesCol.findOne({ udemy_url: course.url });
          if (exists) continue;

          const slug = await ensureUniqueSlug(slugify(course.title), coursesCol);

          await coursesCol.insertOne({
            title: course.title,
            slug,
            description: course.description || '',
            instructor: '',
            category: categorize(course.title, course.description),
            image_url: course.image_url || 'https://img-b.udemycdn.com/course/480x270/placeholder.jpg',
            udemy_url: course.url,
            source: 'studybullet',
            is_published: true,
            telegram_posted: false,
            scraped_at: new Date(),
            created_at: new Date(),
            updated_at: new Date(),
          });
          totalAdded++;
        } catch (err) {
          errors.push(`StudyBullet "${course.title}": ${err}`);
        }
      }

      if (courses.length === 0) break;

    } catch (err) {
      errors.push(`StudyBullet page ${page}: ${err}`);
    }
  }

  return { added: totalAdded, processed: totalProcessed, errors };
}

// ============================================
// Combined Scraper
// ============================================
export async function runFullScrape() {
  const results = {
    udemyfreebies: { added: 0, processed: 0, errors: [] as string[] },
    studybullet: { added: 0, processed: 0, errors: [] as string[] },
  };

  try {
    results.udemyfreebies = await scrapeUdemyFreebies(5);
  } catch (e) {
    results.udemyfreebies.errors.push(`UdemyFreebies error: ${e}`);
  }

  try {
    results.studybullet = await scrapeStudyBullet(3);
  } catch (e) {
    results.studybullet.errors.push(`StudyBullet error: ${e}`);
  }

  // Log results
  const logsCol = await getCollection(COLLECTIONS.SCRAPER_LOGS);
  await logsCol.insertOne({
    type: 'full_scrape',
    results,
    timestamp: new Date(),
  });

  return results;
}
