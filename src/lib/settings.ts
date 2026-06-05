import { COLLECTIONS, DEFAULT_SITE_SETTINGS } from './types';
import { getCollection } from './mongodb';

// Settings helpers
export async function getSetting(key: string): Promise<string | null> {
  const col = await getCollection(COLLECTIONS.SETTINGS);
  const doc = await col.findOne({ _id: key });
  return doc ? String(doc.value) : null;
}

export async function setSetting(key: string, value: string | boolean | number): Promise<void> {
  const col = await getCollection(COLLECTIONS.SETTINGS);
  await col.updateOne(
    { _id: key },
    { $set: { value: String(value), updated_at: new Date() } },
    { upsert: true }
  );
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const col = await getCollection(COLLECTIONS.SETTINGS);
  const docs = await col.find({}).toArray();
  const settings: Record<string, string> = {};
  for (const doc of docs) {
    settings[String(doc._id)] = String(doc.value);
  }
  return settings;
}

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

// Telegram settings
export async function getTelegramSettings() {
  const col = await getCollection(COLLECTIONS.SETTINGS);
  const doc = await col.findOne({ _id: 'telegram' });
  if (!doc) {
    return {
      bot_token: '',
      channels: [{ name: 'القناة الرئيسية', id: '', active: true }],
      auto_post: false,
      message_template: '🔰 {title}\n\n👨‍🏫 {instructor}\n⭐ {rating}\n🎓 {students_count} students\n\n🔗 {link}',
    };
  }
  return doc;
}

export async function saveTelegramSettings(settings: Record<string, unknown>) {
  const col = await getCollection(COLLECTIONS.SETTINGS);
  await col.updateOne(
    { _id: 'telegram' },
    { $set: { ...settings, updated_at: new Date() } },
    { upsert: true }
  );
}
