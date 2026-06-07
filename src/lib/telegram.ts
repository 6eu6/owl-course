import { getTelegramSettings, getUnpostedCourses, markCourseTelegramPosted, logTelegramMessage } from './queries';
import { DEFAULT_TEMPLATES } from './templates';
import { localizedCoursePath, type Locale } from './i18n';

const TELEGRAM_API = 'https://api.telegram.org';

// Default delay between posting messages (in ms)
const DEFAULT_POST_DELAY_MS = 60_000; // 1 minute

type TelegramChannel = { id: string; active: boolean; name: string; language: string };

// ============================================
// Send Message (with optional reply_markup)
// ============================================

async function sendMessage(
  botToken: string,
  chatId: string,
  text: string,
  parseMode: string = 'HTML',
  replyMarkup?: Record<string, unknown>
): Promise<boolean> {
  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: false,
    };
    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }
    const response = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ============================================
// Format Course Message (Beautiful HTML)
// ============================================

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Normalise a possibly-dirty value into a clean string, or '' if it's a placeholder. */
function cleanValue(v: unknown): string {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (/^(unknown|n\/a|none|null|undefined)$/i.test(s)) return '';
  return s;
}

/** A real, paid original price like "$64.00" — not "Free"/empty. */
function realPrice(v: unknown): string {
  const s = cleanValue(v);
  if (!s || /free/i.test(s) || !/\d/.test(s)) return '';
  return s.startsWith('$') ? s : `$${s}`;
}

/**
 * Render a template, dropping any line whose placeholders are all empty so we
 * never print "Instructor: Unknown" or a stray "Price:" with no value.
 */
function renderTemplate(tpl: string, values: Record<string, string>): string {
  return tpl
    .split('\n')
    .map((line) => {
      const keys = [...line.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      if (keys.length > 0 && keys.every((k) => !values[k])) return null; // drop empty line
      return line.replace(/\{(\w+)\}/g, (_, k) => values[k] ?? '');
    })
    .filter((l): l is string => l !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatCourseMessageHtml(
  course: Record<string, unknown>,
  template: string,
): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  const slug = String(course.slug || '');
  const locale = (String(course.locale || 'en') === 'ar' ? 'ar' : 'en') as Locale;
  const courseUrl = (siteUrl && slug) ? `${siteUrl}${localizedCoursePath(locale, slug)}` : String(course.udemy_url || '');

  const ratingNum = Number(course.rating);
  const studentsNum = Number(course.students_count);
  const price = realPrice(course.original_price);

  const values: Record<string, string> = {
    title: escapeHtml(cleanValue(course.title) || 'Course'),
    instructor: escapeHtml(cleanValue(course.instructor)),
    rating: ratingNum > 0 ? `${ratingNum}/5` : '',
    students_count: studentsNum > 0 ? studentsNum.toLocaleString(locale === 'ar' ? 'ar' : 'en') : '',
    original_price: price ? `<s>${escapeHtml(price)}</s>` : '',
    language: escapeHtml(cleanValue(course.language)),
    duration: escapeHtml(cleanValue(course.duration)),
    category: escapeHtml(cleanValue(course.category)),
    link: courseUrl,
  };

  const tpl = template && template.trim() ? template : (locale === 'ar' ? DEFAULT_TEMPLATES.ar : DEFAULT_TEMPLATES.en);
  return renderTemplate(tpl, values);
}

// Build inline keyboard button pointing to site course page
function buildInlineKeyboard(course: Record<string, unknown>, locale: Locale = 'en'): Record<string, unknown> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  const slug = String(course.slug || '');
  const courseUrl = (siteUrl && slug) ? `${siteUrl}${localizedCoursePath(locale, slug)}` : '';

  if (!courseUrl) return {};

  return {
    inline_keyboard: [
      [
        {
          text: locale === 'ar' ? '🚀 ابدأ مجانًا' : '🚀 Enroll Free',
          url: courseUrl,
        },
      ],
    ],
  };
}

// ============================================
// Post a single course to all active channels
// ============================================

export async function postCourseToTelegram(
  course: Record<string, unknown>,
  settings: Record<string, unknown>
): Promise<{ success: boolean; channels: string[] }> {
  // Prefer env token over DB-stored one
  const botToken = process.env.TELEGRAM_BOT_TOKEN || String(settings.bot_token || '');
  const channels = (settings.channels as TelegramChannel[]) || [];

  if (!botToken) return { success: false, channels: [] };

  const activeChannels = channels.filter((c: { active: boolean }) => c.active);
  return postCourseToTelegramChannels(course, settings, activeChannels);
}

export async function postCourseToTelegramChannels(
  course: Record<string, unknown>,
  settings: Record<string, unknown>,
  channels: TelegramChannel[],
): Promise<{ success: boolean; channels: string[]; channelIds: string[]; failed: string[] }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || String(settings.bot_token || '');
  if (!botToken) return { success: false, channels: [], channelIds: [], failed: [] };

  const locale = (String(course.locale || channels[0]?.language || 'en') === 'ar' ? 'ar' : 'en') as Locale;
  const tplEn = String(settings.message_template || '') || DEFAULT_TEMPLATES.en;
  const tplAr = String(settings.message_template_ar || '') || DEFAULT_TEMPLATES.ar;
  const template = locale === 'ar' ? tplAr : tplEn;
  const keyboard = buildInlineKeyboard(course, locale);
  const sentChannels: string[] = [];
  const sentChannelIds: string[] = [];
  const failedChannels: string[] = [];

  for (const channel of channels.filter((c) => c.active && c.id)) {
    const channelMessage = formatCourseMessageHtml(course, template);
    const ok = await sendMessage(botToken, channel.id, channelMessage, 'HTML', keyboard);

    if (ok) {
      sentChannels.push(channel.name || channel.id);
      sentChannelIds.push(channel.id);
    } else {
      failedChannels.push(channel.name || channel.id);
    }
  }

  if (failedChannels.length > 0) {
    console.warn(`[Telegram] ${locale} post reached ${sentChannels.length} channel(s); failed: ${failedChannels.join(', ')}`);
  }

  return { success: sentChannels.length > 0, channels: sentChannels, channelIds: sentChannelIds, failed: failedChannels };
}

// ============================================
// Auto-post unposted courses with delay
// ============================================

export async function autoPostToTelegram(
  limit: number = 5
): Promise<{ posted: number; errors: string[] }> {
  const settings = await getTelegramSettings();
  const token = process.env.TELEGRAM_BOT_TOKEN || settings.bot_token;
  if (!token || !settings.auto_post) {
    return { posted: 0, errors: ['Telegram not configured or auto-post disabled'] };
  }

  // Read custom delay from settings (default 60s)
  const delayMs = settings.post_delay_ms ? settings.post_delay_ms : DEFAULT_POST_DELAY_MS;

  const unposted = await getUnpostedCourses(limit);
  const errors: string[] = [];
  let posted = 0;

  for (let i = 0; i < unposted.length; i++) {
    const course = unposted[i];
    const result = await postCourseToTelegram(
      { ...(course as unknown as Record<string, unknown>), slug: course.slug, locale: 'en' },
      settings as unknown as Record<string, unknown>
    );

    if (result.success) {
      await markCourseTelegramPosted(course.id);
      posted++;
      await logTelegramMessage({
        courseId: course.id,
        courseTitle: course.title,
        channels: result.channels,
        status: 'sent',
      });
    } else {
      errors.push(`Failed to post: ${course.title}`);
    }

    // Add delay between messages (skip delay after the last one)
    if (i < unposted.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return { posted, errors };
}

// ============================================
// Test Telegram Connection
// ============================================

export async function testTelegramConnection(
  botToken: string,
  chatId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const ok = await sendMessage(
      botToken,
      chatId,
      '🧪 Test message from Learn Plus Courses\n\n✅ Connection successful!'
    );
    return ok
      ? { success: true, message: 'Test message sent successfully!' }
      : { success: false, message: 'Failed to send message. Check Bot Token and Channel ID.' };
  } catch (e) {
    return { success: false, message: `Error: ${e}` };
  }
}
