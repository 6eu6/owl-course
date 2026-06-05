// Course type matching the Prisma model
export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  instructor: string;
  category: string;
  imageUrl: string;
  udemyUrl: string;
  source: 'udemyfreebies' | 'studybullet' | 'manual';
  rating: number | null;
  studentsCount: number | null;
  originalPrice: string | null;
  language: string | null;
  duration: string | null;
  couponCode: string | null;
  couponUrl: string | null;
  isPublished: boolean;
  telegramPosted: boolean;
  telegramPostedAt: Date | null;
  scrapedAt: Date;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Telegram settings interface
export interface TelegramSettings {
  bot_token: string;
  channels: TelegramChannel[];
  auto_post: boolean;
  message_template: string;
  join_channel_username?: string;
  contact_username?: string;
}

export interface TelegramChannel {
  name: string;
  id: string;
  active: boolean;
}

// Site settings
export interface SiteSettings {
  site_name: string;
  site_description: string;
  courses_per_page: number;
  scraper_enabled: boolean;
  scraper_interval_hours: number;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  site_name: 'OWL COURSE',
  site_description: 'Free Online Courses Platform',
  courses_per_page: 12,
  scraper_enabled: true,
  scraper_interval_hours: 6,
};

// Scraper result types
export interface SourceResult {
  source: string;
  status: 'success' | 'error' | 'partial';
  newCount: number;
  dupCount: number;
  errCount: number;
  message: string;
  duration: number;
  courses: ScrapedCourseData[];
}

export interface ScrapedCourseData {
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
