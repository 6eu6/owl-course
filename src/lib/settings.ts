import { getAllSettings, getSetting } from './mongodb';

const DEFAULT_SITE_SETTINGS = {
  site_name: 'OWL COURSE',
  site_description: 'Free Online Courses Platform',
  courses_per_page: 12,
  scraper_enabled: true,
  scraper_interval_hours: 6,
};

export interface SiteSettings {
  site_name: string;
  site_description: string;
  courses_per_page: number;
  scraper_enabled: boolean;
  scraper_interval_hours: number;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const settings = await getAllSettings().catch(() => ({}));
  return {
    site_name: settings.site_name || DEFAULT_SITE_SETTINGS.site_name,
    site_description: settings.site_description || DEFAULT_SITE_SETTINGS.site_description,
    courses_per_page: parseInt(settings.courses_per_page || String(DEFAULT_SITE_SETTINGS.courses_per_page)),
    scraper_enabled: settings.scraper_enabled !== 'false',
    scraper_interval_hours: parseInt(settings.scraper_interval_hours || String(DEFAULT_SITE_SETTINGS.scraper_interval_hours)),
  };
}

export { getSetting, getAllSettings };
