import { NextResponse } from 'next/server';

const TELEGRAM_API = 'https://api.telegram.org';

// ============================================
// Helpers
// ============================================

function getAdminBotToken(): string {
  return process.env.ADMIN_BOT_TOKEN || '';
}

function getAllowedChatIds(): string[] {
  const raw = process.env.ADMIN_CHAT_IDS || '';
  if (!raw) return [];
  return raw.split(',').map((id) => id.trim()).filter(Boolean);
}

async function sendAdminMessage(chatId: string, text: string): Promise<boolean> {
  const token = getAdminBotToken();
  if (!token) return false;

  try {
    const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
      signal: AbortSignal.timeout(15000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function isAuthorized(chatId: number | string): boolean {
  const allowed = getAllowedChatIds();
  if (allowed.length === 0) return false;
  return allowed.some((id) => String(id) === String(chatId));
}

// ============================================
// Command Handlers
// ============================================

async function handleStart(chatId: string): Promise<string> {
  return (
    `🦉 <b>OWL COURSE — Admin Bot</b>\n\n` +
    `Welcome! Here are the available commands:\n\n` +
    `<b>📊 /stats</b> — View course statistics\n` +
    `<b>🔄 /scrape</b> — Trigger a manual scraper run\n` +
    `<b>🗑️ /purge</b> — Delete all courses from the database\n` +
    `<b>📡 /channels</b> — List configured Telegram channels\n` +
    `<b>📨 /post</b> — Auto-post new unposted courses to Telegram channels\n`
  );
}

async function handleStats(chatId: string): Promise<string> {
  try {
    const { countCourses, countNewToday, getLastScrapeTime, countCoursesBySource } = await import('@/lib/mongodb');

    const [total, published, bySource, newToday, lastScrapeTime] = await Promise.all([
      countCourses({}),
      countCourses({ isPublished: true }),
      countCoursesBySource(),
      countNewToday(),
      getLastScrapeTime(),
    ]);

    const telegramPosted = await countCourses({ telegramPosted: true });

    const sourceBreakdown = bySource
      .map((s) => `  • ${s._id}: <b>${s.count}</b>`)
      .join('\n');

    const lastScrape = lastScrapeTime
      ? new Date(lastScrapeTime).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Never';

    const msg =
      `📊 <b>OWL COURSE — Statistics</b>\n\n` +
      `📚 Total Courses: <b>${total}</b>\n` +
      `✅ Published: <b>${published}</b>\n` +
      `🆕 New Today: <b>${newToday}</b>\n` +
      `📨 Telegram Posted: <b>${telegramPosted}</b>\n` +
      `⏳ Pending: <b>${published - telegramPosted}</b>\n\n` +
      `📡 <b>Sources:</b>\n${sourceBreakdown || '  No data'}\n\n` +
      `🕐 Last Scrape: <b>${lastScrape}</b>`;

    return msg;
  } catch (e) {
    return `❌ Error fetching stats: ${String(e)}`;
  }
}

async function handleScrape(chatId: string): Promise<void> {
  try {
    await sendAdminMessage(chatId, '⏳ Working... Starting scraper. This may take a few minutes.');

    const { runFullScrape } = await import('@/lib/scraper');
    const results = await runFullScrape({ pages: 5 });

    const msg =
      `🔄 <b>Scraper Results</b>\n\n` +
      `✅ New Courses: <b>${results.totalNew}</b>\n` +
      `🔄 Duplicates: <b>${results.totalDup}</b>\n` +
      `❌ Errors: <b>${results.totalErr}</b>\n` +
      `⏱️ Duration: <b>${Math.round(results.totalDuration / 1000)}s</b>\n\n` +
      `<b>By Source:</b>\n` +
      `• UdemyFreebies: ${results.udemyfreebies.newCount} new, ${results.udemyfreebies.dupCount} dup, ${results.udemyfreebies.errCount} err\n` +
      (results.discudemy
        ? `• DiscUdemy: ${results.discudemy.newCount} new, ${results.discudemy.dupCount} dup, ${results.discudemy.errCount} err\n`
        : '') +
      (results.freebiesglobal
        ? `• FreebiesGlobal: ${results.freebiesglobal.newCount} new, ${results.freebiesglobal.dupCount} dup, ${results.freebiesglobal.errCount} err\n`
        : '');

    await sendAdminMessage(chatId, msg);
  } catch (e) {
    await sendAdminMessage(chatId, `❌ Scraper failed: ${String(e)}`);
  }
}

// Track purge confirmation state
const purgeConfirmations = new Map<string, number>();

async function handlePurge(chatId: string, text: string): Promise<string> {
  // Check if user confirmed
  if (text === '/purge confirm' || text === '/purge yes') {
    const timestamp = purgeConfirmations.get(chatId);
    if (!timestamp || Date.now() - timestamp > 60000) {
      return '❌ Confirmation expired. Please use /purge again.';
    }

    purgeConfirmations.delete(chatId);

    try {
      const { purgeAllCourses } = await import('@/lib/mongodb');
      const result = await purgeAllCourses();
      return `🗑️ <b>Purged!</b>\n\nRemoved <b>${result.removed}</b> courses from the database.`;
    } catch (e) {
      return `❌ Purge failed: ${String(e)}`;
    }
  }

  // First purge call — ask for confirmation
  purgeConfirmations.set(chatId, Date.now());
  return (
    `⚠️ <b>Purge All Courses?</b>\n\n` +
    `This will permanently delete ALL courses from the database.\n` +
    `This action cannot be undone!\n\n` +
    `To confirm, type:\n` +
    `<code>/purge confirm</code>\n\n` +
    `⏰ You have 60 seconds to confirm.`
  );
}

async function handleChannels(chatId: string): Promise<string> {
  try {
    const { getTelegramSettings } = await import('@/lib/mongodb');
    const settings = await getTelegramSettings();
    const token = process.env.TELEGRAM_BOT_TOKEN || settings.bot_token;

    if (!token) {
      return '❌ Publishing bot token not configured. Set TELEGRAM_BOT_TOKEN env variable.';
    }

    const channels = settings.channels || [];

    if (channels.length === 0) {
      return '📡 No channels configured. Add channels in the admin panel.';
    }

    const channelList = channels
      .map((c) => {
        const status = c.active ? '✅ Active' : '❌ Inactive';
        const lang = c.language || 'en';
        return `  • <b>${c.name}</b> (${c.id || 'no ID'})\n    ${status} | Lang: ${lang}`;
      })
      .join('\n\n');

    const autoPostStatus = settings.auto_post ? '✅ Enabled' : '❌ Disabled';

    return (
      `📡 <b>Configured Channels</b> (${channels.length})\n\n` +
      channelList +
      `\n\n🤖 Auto-post: <b>${autoPostStatus}</b>`
    );
  } catch (e) {
    return `❌ Error fetching channels: ${String(e)}`;
  }
}

async function handlePost(chatId: string): Promise<void> {
  try {
    const { getUnpostedCourses, getTelegramSettings, markCourseTelegramPosted, logTelegramMessage } = await import('@/lib/mongodb');
    const { postCourseToTelegram } = await import('@/lib/telegram');

    const settings = await getTelegramSettings();
    const token = process.env.TELEGRAM_BOT_TOKEN || settings.bot_token;
    if (!token) {
      await sendAdminMessage(chatId, '❌ Publishing bot token not configured. Set TELEGRAM_BOT_TOKEN env variable.');
      return;
    }

    const unposted = await getUnpostedCourses(5);

    if (unposted.length === 0) {
      await sendAdminMessage(chatId, '📭 No new courses to post. All caught up!');
      return;
    }

    await sendAdminMessage(chatId, `📨 Posting ${unposted.length} courses...`);

    let posted = 0;
    const errors: string[] = [];

    for (const course of unposted) {
      const courseData = {
        title: course.title,
        instructor: course.instructor,
        category: course.category,
        rating: course.rating,
        students_count: course.studentsCount,
        original_price: course.originalPrice,
        language: course.language,
        duration: course.duration,
        udemy_url: course.couponUrl || course.udemyUrl || '',
        slug: course.slug,
      };

      const result = await postCourseToTelegram(courseData, settings as unknown as Record<string, unknown>);
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
        errors.push(course.title);
      }

      // Delay between posts
      await new Promise((resolve) => setTimeout(resolve, 60_000));
    }

    const msg =
      `📨 <b>Post Results</b>\n\n` +
      `✅ Posted: <b>${posted}</b>\n` +
      `❌ Failed: <b>${errors.length}</b>\n` +
      (errors.length > 0 ? `\nFailed courses:\n${errors.map((e) => `  • ${e}`).join('\n')}` : '');

    await sendAdminMessage(chatId, msg);
  } catch (e) {
    await sendAdminMessage(chatId, `❌ Post failed: ${String(e)}`);
  }
}

// ============================================
// Main POST Handler — Telegram Webhook
// ============================================

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = body.message;

    if (!message || !message.text || !message.chat) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text: string = message.text.trim();

    // Security: Check authorization
    if (!isAuthorized(chatId)) {
      console.log(`[AdminBot] Unauthorized access from chat ${chatId}`);
      await sendAdminMessage(String(chatId), '🚫 Unauthorized. Your chat ID is not in the allowed list.');
      return NextResponse.json({ ok: true });
    }

    const command = text.split(' ')[0].toLowerCase();

    // Route command
    switch (command) {
      case '/start': {
        const reply = await handleStart(String(chatId));
        await sendAdminMessage(String(chatId), reply);
        break;
      }

      case '/stats': {
        const reply = await handleStats(String(chatId));
        await sendAdminMessage(String(chatId), reply);
        break;
      }

      case '/scrape': {
        // Long operation — handle async
        handleScrape(String(chatId));
        return NextResponse.json({ ok: true, message: 'Scraper started' });
      }

      case '/purge':
      case '/purge confirm':
      case '/purge yes': {
        const reply = await handlePurge(String(chatId), text.toLowerCase());
        await sendAdminMessage(String(chatId), reply);
        break;
      }

      case '/channels': {
        const reply = await handleChannels(String(chatId));
        await sendAdminMessage(String(chatId), reply);
        break;
      }

      case '/post': {
        // Long operation — handle async
        handlePost(String(chatId));
        return NextResponse.json({ ok: true, message: 'Post started' });
      }

      default: {
        await sendAdminMessage(
          String(chatId),
          '❓ Unknown command. Type /start to see available commands.'
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[AdminBot] Error:', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// GET handler for webhook verification
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'OWL COURSE Admin Bot webhook endpoint',
  });
}
