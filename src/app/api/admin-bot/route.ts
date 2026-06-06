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

async function sendAdminMessage(chatId: string, text: string, parseMode: string = 'HTML'): Promise<boolean> {
  const token = getAdminBotToken();
  if (!token) return false;

  try {
    const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
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

function isAuthorized(chatId: number | string): boolean {
  const allowed = getAllowedChatIds();
  if (allowed.length === 0) return false;
  return allowed.some((id) => String(id) === String(chatId));
}

// ============================================
// Command: /start
// ============================================

async function handleStart(): Promise<string> {
  return (
    `\u{1F989} <b>Learn Plus Courses \u2014 Admin Bot</b>\n\n` +
    `\u{1F4CB} <b>Available Commands:</b>\n\n` +
    `\u{1F4CA} <b>/stats</b> \u2014 View course statistics\n\n` +
    `\u{1F504} <b>/scrape</b> \u2014 Run the scraper manually\n\n` +
    `\u{1F5D1}\uFE0F <b>/purge</b> \u2014 Delete all courses\n\n` +
    `\u{1F4E1} <b>/channels</b> \u2014 List publishing channels\n` +
    `\u2795 <b>/addch &lt;name&gt; &lt;@id&gt; &lt;lang&gt;</b> \u2014 Add channel\n` +
    `\u274C <b>/rmch &lt;name&gt;</b> \u2014 Remove channel\n` +
    `\u{1F527} <b>/langch &lt;name&gt; &lt;lang&gt;</b> \u2014 Change channel language\n` +
    `\u{1F504} <b>/togglech &lt;name&gt;</b> \u2014 Enable/disable channel\n\n` +
    `\u{1F916} <b>/autopost</b> \u2014 Toggle auto-post on/off\n` +
    `\u23F1\uFE0F <b>/delay &lt;seconds&gt;</b> \u2014 Set delay between posts\n` +
    `\u{1F4DD} <b>/template</b> \u2014 Show current message template\n` +
    `\u{270F}\uFE0F <b>/settemplate &lt;text&gt;</b> \u2014 Set new template\n\n` +
    `\u{1F4E8} <b>/broadcast &lt;text&gt;</b> \u2014 Send message to all channels\n\n` +
    `\u{1F4E4} <b>/post</b> \u2014 Post new unposted courses now`
  );
}

// ============================================
// Command: /stats
// ============================================

async function handleStats(): Promise<string> {
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
    const pending = Math.max(0, published - telegramPosted);

    const sourceBreakdown = bySource
      .map((s) => `  \u2022 ${s._id}: <b>${s.count}</b>`)
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
      `\u{1F4CA} <b>Learn Plus Courses \u2014 Statistics</b>\n\n` +
      `\u{1F4DA} Total Courses: <b>${total}</b>\n` +
      `\u2705 Published: <b>${published}</b>\n` +
      `\u{1F195} New Today: <b>${newToday}</b>\n` +
      `\u{1F4E4} Telegram Posted: <b>${telegramPosted}</b>\n` +
      `\u23F3 Pending: <b>${pending}</b>\n\n` +
      `\u{1F4E1} <b>Sources:</b>\n${sourceBreakdown || '  No data'}\n\n` +
      `\u{1F550} Last Scrape: <b>${lastScrape}</b>`;

    return msg;
  } catch (e) {
    return `\u274C Error fetching stats: ${String(e)}`;
  }
}

// ============================================
// Command: /scrape
// ============================================

async function handleScrape(chatId: string): Promise<void> {
  try {
    await sendAdminMessage(chatId, '\u23F3 Working... Starting scraper. This may take a few minutes.');

    const { runFullScrape } = await import('@/lib/scraper');
    const results = await runFullScrape({ pages: 5 });

    const msg =
      `\u{1F504} <b>Scraper Results</b>\n\n` +
      `\u2705 New Courses: <b>${results.totalNew}</b>\n` +
      `\u{1F504} Duplicates: <b>${results.totalDup}</b>\n` +
      `\u274C Errors: <b>${results.totalErr}</b>\n` +
      `\u23F1\uFE0F Duration: <b>${Math.round(results.totalDuration / 1000)}s</b>\n\n` +
      `<b>By Source:</b>\n` +
      `\u2022 UdemyFreebies: ${results.udemyfreebies.newCount} new, ${results.udemyfreebies.dupCount} dup\n` +
      `\u2022 StudyBullet: ${results.studybullet.newCount} new, ${results.studybullet.dupCount} dup`;

    await sendAdminMessage(chatId, msg);
  } catch (e) {
    await sendAdminMessage(chatId, `\u274C Scraper failed: ${String(e)}`);
  }
}

// ============================================
// Command: /purge
// ============================================

const purgeConfirmations = new Map<string, number>();

async function handlePurge(chatId: string, text: string): Promise<string> {
  if (text === '/purge confirm' || text === '/purge yes') {
    const timestamp = purgeConfirmations.get(chatId);
    if (!timestamp || Date.now() - timestamp > 60000) {
      return '\u274C Confirmation expired. Please use /purge again.';
    }

    purgeConfirmations.delete(chatId);

    try {
      const { purgeAllCourses } = await import('@/lib/mongodb');
      const result = await purgeAllCourses();
      return `\u{1F5D1}\uFE0F <b>Purged!</b>\n\nRemoved <b>${result.removed}</b> courses from the database.`;
    } catch (e) {
      return `\u274C Purge failed: ${String(e)}`;
    }
  }

  purgeConfirmations.set(chatId, Date.now());
  return (
    `\u26A0\uFE0F <b>Purge All Courses?</b>\n\n` +
    `This will permanently delete ALL courses.\n` +
    `This action cannot be undone!\n\n` +
    `To confirm, type:\n` +
    `<code>/purge confirm</code>\n\n` +
    `\u23F0 You have 60 seconds to confirm.`
  );
}

// ============================================
// Command: /channels — List all
// ============================================

async function handleChannels(): Promise<string> {
  try {
    const { getTelegramSettings } = await import('@/lib/mongodb');
    const settings = await getTelegramSettings();
    const channels = settings.channels || [];

    if (channels.length === 0) {
      return `\u{1F4E1} No channels configured yet.\n\nUse <code>/addch name @id lang</code> to add one.`;
    }

    const channelList = channels
      .map((c, i) => {
        const status = c.active ? '\u2705 Active' : '\u274C Inactive';
        const lang = c.language || 'en';
        const id = c.id || 'no ID';
        return `<b>${i + 1}.</b> <b>${c.name}</b>\n    ID: <code>${id}</code>\n    ${status} | Lang: ${lang}`;
      })
      .join('\n\n');

    const autoPostStatus = settings.auto_post ? '\u2705 ON' : '\u274C OFF';
    const delay = settings.post_delay_ms ? `${Math.round(settings.post_delay_ms / 1000)}s` : '60s (default)';

    return (
      `\u{1F4E1} <b>Channels</b> (${channels.length})\n\n` +
      channelList +
      `\n\n\u{1F916} Auto-post: <b>${autoPostStatus}</b>\n` +
      `\u23F1\uFE0F Delay: <b>${delay}</b>`
    );
  } catch (e) {
    return `\u274C Error: ${String(e)}`;
  }
}

// ============================================
// Command: /addch <name> <@id> <language>
// ============================================

async function handleAddChannel(chatId: string, text: string): Promise<string> {
  const parts = text.split(/\s+/);
  if (parts.length < 4) {
    return (
      `\u274C Usage: <code>/addch name @channel_id language</code>\n\n` +
      `<b>Example:</b> <code>/addch Arabic @mychannel ar</code>\n\n` +
      `<b>Languages:</b> en, ar, es, fr, pt, tr, hi, zh, ja, ko, de, ru`
    );
  }

  const name = parts[1];
  const id = parts[2];
  const lang = parts[3].toLowerCase();

  const validLangs = ['en', 'ar', 'es', 'fr', 'pt', 'tr', 'hi', 'zh', 'ja', 'ko', 'de', 'ru'];
  if (!validLangs.includes(lang)) {
    return `\u274C Invalid language "${lang}". Valid: ${validLangs.join(', ')}`;
  }

  try {
    const { getTelegramSettings, saveTelegramSettings } = await import('@/lib/mongodb');
    const settings = await getTelegramSettings();
    const channel = {
      name,
      id,
      active: true,
      language: lang,
    };
    settings.channels = [...(settings.channels || []), channel];
    await saveTelegramSettings(settings);

    return (
      `\u2705 <b>Channel Added!</b>\n\n` +
      `\u2022 Name: <b>${name}</b>\n` +
      `\u2022 ID: <code>${id}</code>\n` +
      `\u2022 Language: <b>${lang}</b>\n` +
      `\u2022 Status: Active\n\n` +
      `Use <code>/channels</code> to see all channels.`
    );
  } catch (e) {
    return `\u274C Failed to add channel: ${String(e)}`;
  }
}

// ============================================
// Command: /rmch <name>
// ============================================

async function handleRemoveChannel(chatId: string, text: string): Promise<string> {
  const parts = text.split(/\s+/);
  if (parts.length < 2) {
    return `\u274C Usage: <code>/rmch channel_name</code>\n\nUse <code>/channels</code> to see channel names.`;
  }

  const name = parts.slice(1).join(' ');

  try {
    const { getTelegramSettings, saveTelegramSettings } = await import('@/lib/mongodb');
    const settings = await getTelegramSettings();
    const before = settings.channels.length;
    settings.channels = (settings.channels || []).filter(
      (c) => c.name.toLowerCase() !== name.toLowerCase()
    );

    if (settings.channels.length === before) {
      return `\u274C Channel "${name}" not found. Use <code>/channels</code> to see names.`;
    }

    await saveTelegramSettings(settings);

    return `\u2705 Channel "<b>${name}</b>" removed. (${before - 1} remaining)`;
  } catch (e) {
    return `\u274C Failed to remove channel: ${String(e)}`;
  }
}

// ============================================
// Command: /langch <name> <lang>
// ============================================

async function handleChannelLang(chatId: string, text: string): Promise<string> {
  const parts = text.split(/\s+/);
  if (parts.length < 3) {
    return `\u274C Usage: <code>/langch channel_name language</code>\n\n<b>Languages:</b> en, ar, es, fr, pt, tr, hi, zh, ja, ko, de, ru`;
  }

  const name = parts[1];
  const lang = parts[2].toLowerCase();

  const validLangs = ['en', 'ar', 'es', 'fr', 'pt', 'tr', 'hi', 'zh', 'ja', 'ko', 'de', 'ru'];
  if (!validLangs.includes(lang)) {
    return `\u274C Invalid language "${lang}".`;
  }

  try {
    const { getTelegramSettings, saveTelegramSettings } = await import('@/lib/mongodb');
    const settings = await getTelegramSettings();
    const channel = (settings.channels || []).find(
      (c) => c.name.toLowerCase() === name.toLowerCase()
    );

    if (!channel) {
      return `\u274C Channel "${name}" not found.`;
    }

    channel.language = lang;
    await saveTelegramSettings(settings);

    return `\u2705 Channel "<b>${name}</b>" language changed to <b>${lang}</b>.`;
  } catch (e) {
    return `\u274C Failed: ${String(e)}`;
  }
}

// ============================================
// Command: /togglech <name>
// ============================================

async function handleToggleChannel(chatId: string, text: string): Promise<string> {
  const parts = text.split(/\s+/);
  if (parts.length < 2) {
    return `\u274C Usage: <code>/togglech channel_name</code>`;
  }

  const name = parts.slice(1).join(' ');

  try {
    const { getTelegramSettings, saveTelegramSettings } = await import('@/lib/mongodb');
    const settings = await getTelegramSettings();
    const channel = (settings.channels || []).find(
      (c) => c.name.toLowerCase() === name.toLowerCase()
    );

    if (!channel) {
      return `\u274C Channel "${name}" not found.`;
    }

    channel.active = !channel.active;
    await saveTelegramSettings(settings);

    const status = channel.active ? '\u2705 Active' : '\u274C Inactive';
    return `\u{1F504} Channel "<b>${name}</b>" is now ${status}.`;
  } catch (e) {
    return `\u274C Failed: ${String(e)}`;
  }
}

// ============================================
// Command: /autopost
// ============================================

async function handleAutopost(): Promise<string> {
  try {
    const { getTelegramSettings, saveTelegramSettings } = await import('@/lib/mongodb');
    const settings = await getTelegramSettings();
    settings.auto_post = !settings.auto_post;
    await saveTelegramSettings(settings);

    return (
      `\u{1F916} <b>Auto-Post</b> is now: <b>${settings.auto_post ? '\u2705 ON' : '\u274C OFF'}</b>\n\n` +
      `New courses will ${settings.auto_post ? 'automatically be posted to channels after each scrape.' : 'NOT be posted automatically.'}`
    );
  } catch (e) {
    return `\u274C Failed: ${String(e)}`;
  }
}

// ============================================
// Command: /delay <seconds>
// ============================================

async function handleDelay(chatId: string, text: string): Promise<string> {
  const parts = text.split(/\s+/);
  if (parts.length < 2) {
    try {
      const { getTelegramSettings } = await import('@/lib/mongodb');
      const settings = await getTelegramSettings();
      const current = settings.post_delay_ms ? Math.round(settings.post_delay_ms / 1000) : 60;
      return (
        `\u23F1\uFE0F <b>Current delay:</b> ${current}s\n\n` +
        `\u274C Usage: <code>/delay seconds</code>\n\n` +
        `<b>Example:</b> <code>/delay 30</code> (30 seconds)\n` +
        `<b>Example:</b> <code>/delay 120</code> (2 minutes)\n\n` +
        `<b>Recommended:</b> 30-120 seconds to avoid Telegram rate limits.`
      );
    } catch {
      return '\u274C Could not read settings.';
    }
  }

  const seconds = parseInt(parts[1]);
  if (isNaN(seconds) || seconds < 5) {
    return '\u274C Minimum delay is 5 seconds. Usage: <code>/delay 60</code>';
  }

  try {
    const { getTelegramSettings, saveTelegramSettings } = await import('@/lib/mongodb');
    const settings = await getTelegramSettings();
    settings.post_delay_ms = seconds * 1000;
    await saveTelegramSettings(settings);

    return (
      `\u23F1\uFE0F <b>Post delay set to ${seconds}s</b>\n\n` +
      `Each course will be posted with a ${seconds}-second gap.`
    );
  } catch (e) {
    return `\u274C Failed: ${String(e)}`;
  }
}

// ============================================
// Command: /template
// ============================================

async function handleTemplate(): Promise<string> {
  try {
    const { getTelegramSettings } = await import('@/lib/mongodb');
    const settings = await getTelegramSettings();

    return (
      `\u{1F4DD} <b>Current Message Template</b>\n\n` +
      `<code>${settings.message_template || '(not set)'}</code>\n\n` +
      `\u{1F525} <b>Available Placeholders:</b>\n` +
      `<code>{title}</code> - Course title\n` +
      `<code>{instructor}</code> - Instructor name\n` +
      `<code>{rating}</code> - Rating\n` +
      `<code>{students_count}</code> - Number of students\n` +
      `<code>{original_price}</code> - Original price\n` +
      `<code>{language}</code> - Course language\n` +
      `<code>{duration}</code> - Course duration\n` +
      `<code>{link}</code> - Course page URL (your site)\n\n` +
      `\u270F\uFE0F Use <code>/settemplate your text here</code> to change.`
    );
  } catch (e) {
    return `\u274C Failed: ${String(e)}`;
  }
}

// ============================================
// Command: /settemplate <text>
// ============================================

async function handleSetTemplate(chatId: string, text: string): Promise<string> {
  const template = text.replace(/^\/settemplate\s*/i, '').trim();

  if (!template) {
    return '\u274C Usage: <code>/settemplate Your message template here</code>';
  }

  try {
    const { getTelegramSettings, saveTelegramSettings } = await import('@/lib/mongodb');
    const settings = await getTelegramSettings();
    settings.message_template = template;
    await saveTelegramSettings(settings);

    return (
      `\u270F\uFE0F <b>Template Updated!</b>\n\n` +
      `New template:\n<code>${template}</code>`
    );
  } catch (e) {
    return `\u274C Failed: ${String(e)}`;
  }
}

// ============================================
// Command: /broadcast <text>
// ============================================

async function handleBroadcast(chatId: string, text: string): Promise<void> {
  const message = text.replace(/^\/broadcast\s*/i, '').trim();

  if (!message) {
    await sendAdminMessage(chatId, '\u274C Usage: <code>/broadcast Your message here</code>\n\nThis sends the message to ALL active publishing channels.');
    return;
  }

  try {
    const { getTelegramSettings } = await import('@/lib/mongodb');
    const settings = await getTelegramSettings();
    const token = process.env.TELEGRAM_BOT_TOKEN || settings.bot_token;

    if (!token) {
      await sendAdminMessage(chatId, '\u274C Publishing bot token not configured.');
      return;
    }

    const channels = (settings.channels || []).filter((c) => c.active && c.id);
    if (channels.length === 0) {
      await sendAdminMessage(chatId, '\u274C No active channels to broadcast to.');
      return;
    }

    await sendAdminMessage(chatId, `\u{1F4E8} Broadcasting to <b>${channels.length}</b> channels...`);

    let sent = 0;
    let failed = 0;

    for (const channel of channels) {
      try {
        const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: channel.id,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: false,
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (response.ok) sent++;
        else failed++;
      } catch {
        failed++;
      }

      // Small delay between broadcasts
      if (sent + failed < channels.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    await sendAdminMessage(
      chatId,
      `\u{1F4E8} <b>Broadcast Complete</b>\n\n\u2705 Sent: <b>${sent}</b>\n\u274C Failed: <b>${failed}</b>`
    );
  } catch (e) {
    await sendAdminMessage(chatId, `\u274C Broadcast failed: ${String(e)}`);
  }
}

// ============================================
// Command: /post
// ============================================

async function handlePost(chatId: string): Promise<void> {
  try {
    const { getUnpostedCourses, getTelegramSettings, markCourseTelegramPosted, logTelegramMessage } = await import('@/lib/mongodb');
    const { postCourseToTelegram } = await import('@/lib/telegram');

    const settings = await getTelegramSettings();
    const token = process.env.TELEGRAM_BOT_TOKEN || settings.bot_token;
    if (!token) {
      await sendAdminMessage(chatId, '\u274C Publishing bot token not configured. Set TELEGRAM_BOT_TOKEN env variable.');
      return;
    }

    const unposted = await getUnpostedCourses(10);

    if (unposted.length === 0) {
      await sendAdminMessage(chatId, '\u{1F4ED} No new courses to post. All caught up!');
      return;
    }

    await sendAdminMessage(chatId, `\u{1F4E4} Posting <b>${unposted.length}</b> courses...`);

    // Read delay from settings
    const delayMs = settings.post_delay_ms ? settings.post_delay_ms : 60_000;

    let posted = 0;
    const errors: string[] = [];

    for (let i = 0; i < unposted.length; i++) {
      const course = unposted[i];
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
        await sendAdminMessage(chatId, `\u2705 [${posted}/${unposted.length}] ${course.title.slice(0, 50)}`);
      } else {
        errors.push(course.title);
      }

      // Delay between posts (skip after last)
      if (i < unposted.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    const msg =
      `\u{1F4E4} <b>Post Complete</b>\n\n` +
      `\u2705 Posted: <b>${posted}</b>\n` +
      `\u274C Failed: <b>${errors.length}</b>\n` +
      `\u23F1\uFE0F Delay: ${Math.round(delayMs / 1000)}s` +
      (errors.length > 0 ? `\n\nFailed:\n${errors.map((e) => `\u2022 ${e}`).join('\n')}` : '');

    await sendAdminMessage(chatId, msg);
  } catch (e) {
    await sendAdminMessage(chatId, `\u274C Post failed: ${String(e)}`);
  }
}

// ============================================
// Main POST Handler - Telegram Webhook
// ============================================

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = body.message;

    if (!message || !message.text || !message.chat) {
      return NextResponse.json({ ok: true });
    }

    const chatId = String(message.chat.id);
    const text: string = message.text.trim();

    // Security: Check authorization
    if (!isAuthorized(chatId)) {
      console.log(`[AdminBot] Unauthorized from ${chatId}`);
      await sendAdminMessage(chatId, '\u{1F6AB} Unauthorized. Your chat ID is not in the allowed list.');
      return NextResponse.json({ ok: true });
    }

    const command = text.split(' ')[0].toLowerCase();

    switch (command) {
      case '/start': {
        const reply = await handleStart();
        await sendAdminMessage(chatId, reply);
        break;
      }

      case '/stats': {
        const reply = await handleStats();
        await sendAdminMessage(chatId, reply);
        break;
      }

      case '/scrape': {
        handleScrape(chatId);
        return NextResponse.json({ ok: true, message: 'Scraper started' });
      }

      case '/purge':
      case '/purge confirm':
      case '/purge yes': {
        const reply = await handlePurge(chatId, text.toLowerCase());
        await sendAdminMessage(chatId, reply);
        break;
      }

      case '/channels': {
        const reply = await handleChannels();
        await sendAdminMessage(chatId, reply);
        break;
      }

      case '/addch': {
        const reply = await handleAddChannel(chatId, text);
        await sendAdminMessage(chatId, reply);
        break;
      }

      case '/rmch': {
        const reply = await handleRemoveChannel(chatId, text);
        await sendAdminMessage(chatId, reply);
        break;
      }

      case '/langch': {
        const reply = await handleChannelLang(chatId, text);
        await sendAdminMessage(chatId, reply);
        break;
      }

      case '/togglech': {
        const reply = await handleToggleChannel(chatId, text);
        await sendAdminMessage(chatId, reply);
        break;
      }

      case '/autopost': {
        const reply = await handleAutopost();
        await sendAdminMessage(chatId, reply);
        break;
      }

      case '/delay': {
        const reply = await handleDelay(chatId, text);
        await sendAdminMessage(chatId, reply);
        break;
      }

      case '/template': {
        const reply = await handleTemplate();
        await sendAdminMessage(chatId, reply);
        break;
      }

      case '/settemplate': {
        const reply = await handleSetTemplate(chatId, text);
        await sendAdminMessage(chatId, reply);
        break;
      }

      case '/broadcast': {
        handleBroadcast(chatId, text);
        return NextResponse.json({ ok: true, message: 'Broadcast started' });
      }

      case '/post': {
        handlePost(chatId);
        return NextResponse.json({ ok: true, message: 'Post started' });
      }

      default: {
        await sendAdminMessage(chatId, '\u2753 Unknown command. Type /start to see available commands.');
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
    message: 'Learn Plus Courses Admin Bot webhook endpoint',
  });
}
