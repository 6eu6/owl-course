import { DEFAULT_SITE_SETTINGS } from './types';
import { getSetting, setSetting, getAllSettings, getTelegramSettings, saveTelegramSettings } from './mongodb';

export { getSetting, setSetting, getAllSettings, getTelegramSettings, saveTelegramSettings };

// Get site settings with defaults
export async function getSiteSettings() {
  const settings = await getAllSettings();
  return {
    site_name: settings.site_name || DEFAULT_SITE_SETTINGS.site_name,
    site_description: settings.site_description || DEFAULT_SITE_SETTINGS.site_description,
    courses_per_page: parseInt(settings.courses_per_page || String(DEFAULT_SITE_SETTINGS.courses_per_page)),
    scraper_enabled: settings.scraper_enabled === 'true',
    scraper_interval_hours: parseInt(settings.scraper_interval_hours || '6'),
  };
}
