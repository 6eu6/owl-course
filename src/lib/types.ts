// MongoDB Collections
export const COLLECTIONS = {
  COURSES: 'courses',
  SETTINGS: 'settings',
  TELEGRAM_MESSAGES: 'telegram_messages',
  SCRAPER_LOGS: 'scraper_logs',
  VISITORS: 'visitors',
} as const;

// Course document interface
export interface Course {
  _id?: string;
  title: string;
  slug: string;
  description: string;
  instructor: string;
  category: string;
  image_url: string;
  udemy_url: string;
  source: 'udemyfreebies' | 'studybullet' | 'manual';
  rating?: number;
  students_count?: number;
  original_price?: string;
  language?: string;
  duration?: string;
  is_published: boolean;
  telegram_posted: boolean;
  telegram_posted_at?: Date;
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
