import { COLLECTIONS } from './types';
import { getCollection } from './mongodb';

const TELEGRAM_API = 'https://api.telegram.org';

// Send message to a Telegram channel
async function sendMessage(botToken: string, chatId: string, text: string, parseMode: string = 'HTML'): Promise<boolean> {
  try {
    const response = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: false,
      }),
      signal: AbortSignal.timeout(15000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Format course message from template
function formatMessage(template: string, course: Record<string, unknown>): string {
  return template
    .replace(/{title}/g, String(course.title || 'Untitled Course'))
    .replace(/{instructor}/g, String(course.instructor || 'Unknown'))
    .replace(/{category}/g, String(course.category || 'General'))
    .replace(/{rating}/g, String(course.rating || 'N/A'))
    .replace(/{students_count}/g, String(course.students_count || 'N/A'))
    .replace(/{original_price}/g, String(course.original_price || 'Free'))
    .replace(/{language}/g, String(course.language || 'English'))
    .replace(/{duration}/g, String(course.duration || 'Self-paced'))
    .replace(/{link}/g, String(course.udemy_url || '#'))
    .replace(/{site_url}/g, process.env.NEXT_PUBLIC_SITE_URL || '');
}

// Post a single course to all active channels
export async function postCourseToTelegram(course: Record<string, unknown>, settings: Record<string, unknown>): Promise<{ success: boolean; channels: string[] }> {
  const botToken = String(settings.bot_token || '');
  const channels = (settings.channels as Array<{ id: string; active: boolean; name: string }>) || [];
  const template = String(settings.message_template || '{title}\n{link}');

  if (!botToken) return { success: false, channels: [] };

  const activeChannels = channels.filter((c: { active: boolean }) => c.active);
  const sentChannels: string[] = [];
  let allSuccess = true;

  const message = formatMessage(template, course);

  for (const channel of activeChannels) {
    if (!channel.id) continue;
    const ok = await sendMessage(botToken, channel.id, message);
    if (ok) {
      sentChannels.push(channel.name);
    } else {
      allSuccess = false;
    }
  }

  return { success: allSuccess && sentChannels.length > 0, channels: sentChannels };
}

// Auto-post unpublished courses to Telegram
export async function autoPostToTelegram(limit: number = 5): Promise<{ posted: number; errors: string[] }> {
  const settings = await (await import('./settings')).getTelegramSettings();
  if (!settings.bot_token || !settings.auto_post) {
    return { posted: 0, errors: ['Telegram not configured or auto-post disabled'] };
  }

  const coursesCol = await getCollection(COLLECTIONS.COURSES);
  const unposted = await coursesCol
    .find({ is_published: true, telegram_posted: { $ne: true } })
    .sort({ scraped_at: -1 })
    .limit(limit)
    .toArray();

  const errors: string[] = [];
  let posted = 0;

  for (const course of unposted) {
    const result = await postCourseToTelegram(course as Record<string, unknown>, settings as Record<string, unknown>);
    if (result.success) {
      await coursesCol.updateOne(
        { _id: course._id },
        { $set: { telegram_posted: true, telegram_posted_at: new Date() } }
      );
      posted++;

      // Save to telegram messages log
      const msgCol = await getCollection(COLLECTIONS.TELEGRAM_MESSAGES);
      await msgCol.insertOne({
        course_id: course._id,
        course_title: course.title,
        channels: result.channels,
        status: 'sent',
        sent_at: new Date(),
      });
    } else {
      errors.push(`Failed to post: ${course.title}`);
    }
  }

  return { posted, errors };
}

// Test Telegram connection
export async function testTelegramConnection(botToken: string, chatId: string): Promise<{ success: boolean; message: string }> {
  try {
    const ok = await sendMessage(botToken, chatId, '🧪 Test message from OWL COURSE\n\n✅ Connection successful!');
    return ok
      ? { success: true, message: 'تم إرسال رسالة الاختبار بنجاح!' }
      : { success: false, message: 'فشل إرسال الرسالة. تحقق من Bot Token و Channel ID.' };
  } catch (e) {
    return { success: false, message: `خطأ: ${e}` };
  }
}
