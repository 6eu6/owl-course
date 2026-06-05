// Course document interface (matches Prisma model)
export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string;
  instructor: string;
  category: string;
  image_url: string;
  udemy_url: string;
  source: 'udemyfreebies' | 'studybullet' | 'manual';
  rating?: number | null;
  students_count?: number | null;
  original_price?: string | null;
  language?: string | null;
  duration?: string | null;
  is_published: boolean;
  telegram_posted: boolean;
  telegram_posted_at?: Date | null;
  scraped_at: Date;
  created_at: Date;
  updated_at: Date;
}

// Telegram settings
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

// Default settings
export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  site_name: 'OWL COURSE',
  site_description: 'Free Online Courses Platform',
  courses_per_page: 12,
  scraper_enabled: true,
  scraper_interval_hours: 6,
};
