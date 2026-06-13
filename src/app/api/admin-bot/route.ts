import { NextResponse } from 'next/server';

// =====================================================================
// Learn Plus Courses — Telegram Admin Bot
// The MAIN MENU is a persistent Reply Keyboard (English) shown under the
// message input; its buttons arrive as normal text messages. Detailed
// actions inside a section still use inline keyboards. Authorisation is by
// ADMIN_CHAT_IDS. Free-text / guided inputs (add channel, templates, delay,
// broadcast, settings) use a short-lived pending state in the DB
// (Setting `botstate:*`); the Add Channel flow is multi-step
// (name -> @handle/chat_id -> language).
// =====================================================================

const TELEGRAM_API = 'https://api.telegram.org';
const LANGS = ['en', 'ar', 'es', 'fr', 'pt', 'tr', 'hi', 'zh', 'ja', 'ko', 'de', 'ru'];

type Btn = { text: string; callback_data: string };
type Keyboard = { inline_keyboard: Btn[][] };
type ReplyKeyboard = {
  keyboard: { text: string }[][];
  resize_keyboard: boolean;
  is_persistent: boolean;
};

// --------------------------------------------------------------------
// Low-level Telegram helpers
// --------------------------------------------------------------------

function botToken(): string {
  return process.env.ADMIN_BOT_TOKEN || '';
}

async function tg(method: string, payload: Record<string, unknown>): Promise<boolean> {
  const token = botToken();
  if (!token) return false;
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function sendMessage(chatId: string, text: string, keyboard?: Keyboard) {
  return tg('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: keyboard } : {}),
  });
}

function editMessage(chatId: string, messageId: number, text: string, keyboard?: Keyboard) {
  return tg('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: keyboard } : {}),
  });
}

function answerCallback(id: string, text?: string) {
  return tg('answerCallbackQuery', { callback_query_id: id, ...(text ? { text } : {}) });
}

// --------------------------------------------------------------------
// Authorisation
// --------------------------------------------------------------------

function allowedChatIds(): string[] {
  return (process.env.ADMIN_CHAT_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
}

function isAuthorized(chatId: number | string): boolean {
  const allowed = allowedChatIds();
  return allowed.length > 0 && allowed.some((id) => String(id) === String(chatId));
}

// --------------------------------------------------------------------
// Pending-input state (DB-backed, expires after 5 minutes)
// --------------------------------------------------------------------

async function setState(chatId: string, action: string, extra?: string): Promise<void> {
  const { setSetting } = await import('@/lib/queries');
  await setSetting(`botstate:${chatId}`, JSON.stringify({ action, extra: extra || '', ts: Date.now() }));
}

async function getState(chatId: string): Promise<{ action: string; extra: string } | null> {
  const { getSetting } = await import('@/lib/queries');
  const raw = await getSetting(`botstate:${chatId}`);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (Date.now() - (s.ts || 0) > 5 * 60 * 1000) return null;
    return { action: s.action, extra: s.extra || '' };
  } catch {
    return null;
  }
}

async function clearState(chatId: string): Promise<void> {
  const { setSetting } = await import('@/lib/queries');
  await setSetting(`botstate:${chatId}`, '');
}

// --------------------------------------------------------------------
// Keyboard builders
// --------------------------------------------------------------------

const mainMenu: Keyboard = {
  inline_keyboard: [
    [{ text: '📊 Statistics', callback_data: 'nav:stats' }, { text: '🔄 Scraper', callback_data: 'nav:scrape' }],
    [{ text: '📡 Channels', callback_data: 'nav:chan' }, { text: '📤 Posting', callback_data: 'nav:post' }],
    [{ text: '📝 Templates', callback_data: 'nav:tpl' }, { text: '🧹 Cleanup', callback_data: 'nav:clean' }],
    [{ text: '📨 Broadcast', callback_data: 'ask:bcast' }, { text: '⚙️ Settings', callback_data: 'nav:set' }],
    [{ text: '🔗 Link Ads', callback_data: 'nav:short' }],
  ],
};

const backRow = (to = 'nav:main'): Btn[] => [{ text: '⬅️ Back', callback_data: to }];

// Persistent Reply Keyboard shown under the message input — the MAIN MENU.
// English only. Each button sends a normal text message handled below.
const mainReplyKeyboard: ReplyKeyboard = {
  keyboard: [
    [{ text: '📊 Statistics' }, { text: '📤 Posting' }],
    [{ text: '📡 Channels' }, { text: '🔄 Scraper' }],
    [{ text: '📝 Templates' }, { text: '🧹 Cleanup' }],
    [{ text: '➕ Add Channel' }, { text: '📨 Broadcast' }],
    [{ text: '⚙️ Settings' }, { text: '🔗 Link Ads' }],
    [{ text: '📖 Help' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

// Send a message that (re)attaches the persistent reply keyboard to the chat.
function sendWithReplyKeyboard(chatId: string, text: string) {
  return tg('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: mainReplyKeyboard,
  });
}

function welcomeText(): string {
  return (
    `🎛️ <b>Learn Plus Courses — Admin Control Panel</b>\n\n` +
    `Use the keyboard below to manage everything. Tap a button to open a section.`
  );
}

function helpText(): string {
  return (
    `📖 <b>Help</b>\n\n` +
    `Use the keyboard below the input box:\n\n` +
    `📊 <b>Statistics</b> — course & posting stats\n` +
    `📤 <b>Posting</b> — auto-post on/off, post now, delay\n` +
    `📡 <b>Channels</b> — list, enable/disable, language, remove\n` +
    `🔄 <b>Scraper</b> — run the scraper now\n` +
    `📝 <b>Templates</b> — edit EN/AR post templates\n` +
    `🧹 <b>Cleanup</b> — remove duplicates/invalid, purge\n` +
    `➕ <b>Add Channel</b> — guided: name → @handle/id → language\n` +
    `📨 <b>Broadcast</b> — send a message to all active channels\n` +
    `⚙️ <b>Settings</b> — site name, description, courses per page`
  );
}

// --------------------------------------------------------------------
// Views — each returns { text, keyboard }
// --------------------------------------------------------------------

function viewMain(): { text: string; keyboard: Keyboard } {
  return {
    text:
      `🎛️ <b>Learn Plus Courses — Control Panel</b>\n\n` +
      `Pick a section below.`,
    keyboard: mainMenu,
  };
}

async function viewStats(): Promise<{ text: string; keyboard: Keyboard }> {
  const { countCourses, countNewToday, getLastScrapeTime, countCoursesBySource } = await import('@/lib/queries');
  const [total, published, bySource, newToday, last] = await Promise.all([
    countCourses({}),
    countCourses({ isPublished: true }),
    countCoursesBySource(),
    countNewToday(),
    getLastScrapeTime(),
  ]);
  const posted = await countCourses({ telegramPosted: true });
  const pending = Math.max(0, published - posted);
  const sources = bySource.map((s) => `  • ${s._id}: <b>${s.count}</b>`).join('\n') || '  —';
  const lastStr = last
    ? new Date(last).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Never';
  return {
    text:
      `📊 <b>Statistics</b>\n\n` +
      `📚 Total: <b>${total}</b>\n✅ Published: <b>${published}</b>\n🆕 New today: <b>${newToday}</b>\n` +
      `📤 Posted: <b>${posted}</b>\n⏳ Pending: <b>${pending}</b>\n\n<b>By source:</b>\n${sources}\n\n🕐 Last scrape: <b>${lastStr}</b>`,
    keyboard: { inline_keyboard: [[{ text: '🔄 Refresh', callback_data: 'nav:stats' }], backRow()] },
  };
}

function viewScrape(): { text: string; keyboard: Keyboard } {
  return {
    text:
      `🔄 <b>Scraper</b>\n\n` +
      `Run the scraper manually. 3 pages fits the 60s serverless limit; the scheduled cron handles deeper runs.\n` +
      `Both sources are free-coupon-only, so coupons are trusted on extraction.`,
    keyboard: {
      inline_keyboard: [
        [{ text: '▶️ Run all (3 pages)', callback_data: 'act:scrape:3:all' }],
        [{ text: 'UdemyFreebies', callback_data: 'act:scrape:3:uf' }, { text: 'StudyBullet', callback_data: 'act:scrape:3:sb' }],
        [{ text: '▶️ Run all (5 pages)', callback_data: 'act:scrape:5:all' }],
        backRow(),
      ],
    },
  };
}

function viewClean(): { text: string; keyboard: Keyboard } {
  return {
    text:
      `🧹 <b>Cleanup</b>\n\n` +
      `• <b>Duplicates</b> — remove courses with the same title.\n` +
      `• <b>Invalid</b> — remove empty/placeholder coupons & bad rows.\n` +
      `• <b>Purge</b> — delete <u>all</u> courses (irreversible).`,
    keyboard: {
      inline_keyboard: [
        [{ text: '🧽 Remove duplicates', callback_data: 'act:clean:dedup' }],
        [{ text: '🧯 Clean invalid', callback_data: 'act:clean:invalid' }],
        [{ text: '🗑️ Purge ALL', callback_data: 'act:clean:purge' }],
        backRow(),
      ],
    },
  };
}

async function viewChannels(): Promise<{ text: string; keyboard: Keyboard }> {
  const { getTelegramSettings } = await import('@/lib/queries');
  const s = await getTelegramSettings();
  const channels = s.channels || [];
  const rows: Btn[][] = [];
  channels.forEach((c, i) => {
    rows.push([{ text: `${c.active ? '✅' : '❌'} ${c.name} · ${c.language || 'en'}`, callback_data: `ch:info:${i}` }]);
    rows.push([
      { text: c.active ? '⏸ Disable' : '▶️ Enable', callback_data: `ch:tog:${i}` },
      { text: '🌐 Lang', callback_data: `ch:lang:${i}` },
      { text: '🗑 Remove', callback_data: `ch:rm:${i}` },
    ]);
  });
  rows.push([{ text: '➕ Add channel', callback_data: 'ask:addch' }]);
  rows.push(backRow());
  return {
    text:
      `📡 <b>Channels</b> (${channels.length})\n\n` +
      (channels.length ? `Tap a channel's buttons to enable/disable, change language, or remove it.` : `No channels yet. Tap the Add Channel button.`),
    keyboard: { inline_keyboard: rows },
  };
}

async function viewPosting(): Promise<{ text: string; keyboard: Keyboard }> {
  const { getTelegramSettings } = await import('@/lib/queries');
  const s = await getTelegramSettings();
  const delay = s.post_delay_ms ? Math.round(s.post_delay_ms / 1000) : 60;
  return {
    text:
      `📤 <b>Posting</b>\n\n` +
      `🤖 Auto-post: <b>${s.auto_post ? '✅ ON' : '❌ OFF'}</b>\n` +
      `⏱️ Delay between posts: <b>${delay}s</b>\n\n` +
      `Auto-post sends new courses to active channels after each scrape.`,
    keyboard: {
      inline_keyboard: [
        [{ text: s.auto_post ? '🔕 Turn auto-post OFF' : '🔔 Turn auto-post ON', callback_data: 'act:autopost' }],
        [{ text: '📤 Post new now', callback_data: 'act:postnow' }],
        [{ text: '⏱️ Set delay', callback_data: 'ask:delay' }],
        backRow(),
      ],
    },
  };
}

async function viewTemplates(): Promise<{ text: string; keyboard: Keyboard }> {
  const { getTelegramSettings } = await import('@/lib/queries');
  const s = await getTelegramSettings();
  return {
    text:
      `📝 <b>Message Templates</b>\n\n` +
      `<b>EN:</b>\n<code>${escapeHtml(s.message_template || '(not set)')}</code>\n\n` +
      `<b>AR:</b>\n<code>${escapeHtml(s.message_template_ar || '(not set)')}</code>\n\n` +
      `Placeholders: {title} {instructor} {rating} {students_count} {original_price} {language} {duration} {link}`,
    keyboard: {
      inline_keyboard: [
        [{ text: '✏️ Set EN', callback_data: 'ask:tplen' }, { text: '✏️ Set AR', callback_data: 'ask:tplar' }],
        backRow(),
      ],
    },
  };
}

async function viewSettings(): Promise<{ text: string; keyboard: Keyboard }> {
  const { getSiteSettings } = await import('@/lib/settings');
  const s = await getSiteSettings();
  return {
    text:
      `⚙️ <b>Site Settings</b>\n\n` +
      `🏷️ Name: <b>${escapeHtml(s.site_name)}</b>\n` +
      `🧾 Description: <b>${escapeHtml(s.site_description)}</b>\n` +
      `📄 Courses per page: <b>${s.courses_per_page}</b>`,
    keyboard: {
      inline_keyboard: [
        [{ text: '✏️ Name', callback_data: 'ask:sitename' }, { text: '✏️ Description', callback_data: 'ask:sitedesc' }],
        [{ text: '✏️ Per-page', callback_data: 'ask:perpage' }],
        backRow(),
      ],
    },
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --------------------------------------------------------------------
// Long-running actions (always awaited — serverless kills after response)
// --------------------------------------------------------------------

async function runScrape(chatId: string, pages: number, which: 'all' | 'uf' | 'sb') {
  const sources = which === 'uf' ? ['udemyfreebies'] : which === 'sb' ? ['studybullet'] : undefined;
  await sendMessage(chatId, `⏳ Scraping (${pages} pages${sources ? `, ${sources[0]}` : ''})…`);
  try {
    const { runFullScrape } = await import('@/lib/scraper');
    const r = await runFullScrape({ pages, sources, skipVerification: true, skipCleanup: true });
    await sendMessage(
      chatId,
      `🔄 <b>Scrape done</b>\n\n✅ New: <b>${r.totalNew}</b>\n🔁 Duplicates: <b>${r.totalDup}</b>\n❌ Errors: <b>${r.totalErr}</b>\n⏱️ ${Math.round(r.totalDuration / 1000)}s`,
      { inline_keyboard: [[{ text: '📤 Post new now', callback_data: 'act:postnow' }], backRow('nav:scrape')] },
    );
  } catch (e) {
    await sendMessage(chatId, `❌ Scrape failed: ${String(e)}`);
  }
}

async function postNow(chatId: string) {
  const { getUnpostedCourses, getTelegramSettings, markCourseTelegramPosted, logTelegramMessage } = await import('@/lib/queries');
  const { postCourseToTelegram } = await import('@/lib/telegram');
  const settings = await getTelegramSettings();
  const token = process.env.TELEGRAM_BOT_TOKEN || settings.bot_token;
  if (!token) {
    await sendMessage(chatId, '❌ Publishing bot token (TELEGRAM_BOT_TOKEN) is not set.');
    return;
  }
  const unposted = await getUnpostedCourses(10);
  if (unposted.length === 0) {
    await sendMessage(chatId, '📭 Nothing to post — all caught up!');
    return;
  }
  await sendMessage(chatId, `📤 Posting <b>${unposted.length}</b> course(s)…`);
  const delayMs = settings.post_delay_ms || 60_000;
  let posted = 0;
  const failed: string[] = [];
  for (let i = 0; i < unposted.length; i++) {
    const c = unposted[i];
    const data = {
      title: c.title, instructor: c.instructor, category: c.category, rating: c.rating,
      students_count: c.studentsCount, original_price: c.originalPrice, language: c.language,
      duration: c.duration, udemy_url: c.couponUrl || c.udemyUrl || '', slug: c.slug,
    };
    const res = await postCourseToTelegram(data, settings as unknown as Record<string, unknown>);
    if (res.success) {
      await markCourseTelegramPosted(c.id);
      posted++;
      await logTelegramMessage({ courseId: c.id, courseTitle: c.title, channels: res.channels, status: 'sent' });
    } else {
      failed.push(c.title);
    }
    if (i < unposted.length - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  await sendMessage(
    chatId,
    `📤 <b>Posting done</b>\n\n✅ Posted: <b>${posted}</b>\n❌ Failed: <b>${failed.length}</b>` +
      (failed.length ? `\n\n${failed.map((t) => `• ${t.slice(0, 50)}`).join('\n')}` : ''),
  );
}

async function broadcast(chatId: string, msg: string) {
  const { getTelegramSettings } = await import('@/lib/queries');
  const settings = await getTelegramSettings();
  const token = process.env.TELEGRAM_BOT_TOKEN || settings.bot_token;
  const channels = (settings.channels || []).filter((c) => c.active && c.id);
  if (!token || channels.length === 0) {
    await sendMessage(chatId, '❌ No publishing token or no active channels.');
    return;
  }
  await sendMessage(chatId, `📨 Broadcasting to <b>${channels.length}</b> channel(s)…`);
  let sent = 0, fail = 0;
  for (const ch of channels) {
    const ok = await tg('sendMessage', { chat_id: ch.id, text: msg, parse_mode: 'HTML' });
    if (ok) sent++; else fail++;
    await new Promise((r) => setTimeout(r, 1500));
  }
  await sendMessage(chatId, `📨 <b>Broadcast done</b>\n✅ ${sent} · ❌ ${fail}`);
}

async function viewShortener(): Promise<{ text: string; keyboard: Keyboard }> {
  const { getShortenerSettings } = await import('@/lib/shortener');
  const s = await getShortenerSettings();
  const hasToken = !!(process.env.SHRINKME_API_TOKEN || '').trim();
  const status = s.enabled ? '🟢 ON' : '🔴 OFF';
  const freqLabel = s.everyN <= 1 ? 'every link' : `every ${s.everyN}ᵗʰ click`;
  const sel = (n: number) => (s.enabled && s.everyN === n ? '✅ ' : '');
  return {
    text:
      `🔗 <b>Link Ads (ShrinkMe)</b>\n\n` +
      `Status: <b>${status}</b>\n` +
      `Ad frequency: <b>${freqLabel}</b>\n\n` +
      `Visitors open ${Math.max(s.everyN - 1, 0)} course links normally, then the ${s.everyN <= 1 ? 'next' : `${s.everyN}ᵗʰ`} opens through an ad — so it earns without annoying.\n` +
      (hasToken ? '' : `\n⚠️ <b>SHRINKME_API_TOKEN is not set</b> — links stay direct until you add it in the Vercel env.`),
    keyboard: {
      inline_keyboard: [
        [{ text: s.enabled ? '🔕 Turn ads OFF' : '🔔 Turn ads ON', callback_data: 'act:short:toggle' }],
        [
          { text: `${sel(8)}Low (8)`, callback_data: 'act:short:freq:8' },
          { text: `${sel(5)}Medium (5)`, callback_data: 'act:short:freq:5' },
          { text: `${sel(3)}High (3)`, callback_data: 'act:short:freq:3' },
        ],
        [
          { text: `${sel(1)}Every link`, callback_data: 'act:short:freq:1' },
          { text: '✏️ Custom every N', callback_data: 'ask:shortfreq' },
        ],
        backRow(),
      ],
    },
  };
}

// --------------------------------------------------------------------
// Callback (inline button) handler
// --------------------------------------------------------------------

async function handleCallback(chatId: string, messageId: number, data: string, cbId: string) {
  const { getTelegramSettings, saveTelegramSettings, cleanupInvalidCourses, purgeAllCourses } = await import('@/lib/queries');

  // Navigation
  if (data === 'nav:main') { await answerCallback(cbId); return sendWithReplyKeyboard(chatId, '⌨️ Main menu — use the keyboard below.'); }
  if (data === 'nav:stats') { await answerCallback(cbId); const v = await viewStats(); return editMessage(chatId, messageId, v.text, v.keyboard); }
  if (data === 'nav:scrape') { await answerCallback(cbId); const v = viewScrape(); return editMessage(chatId, messageId, v.text, v.keyboard); }
  if (data === 'nav:clean') { await answerCallback(cbId); const v = viewClean(); return editMessage(chatId, messageId, v.text, v.keyboard); }
  if (data === 'nav:chan') { await answerCallback(cbId); const v = await viewChannels(); return editMessage(chatId, messageId, v.text, v.keyboard); }
  if (data === 'nav:post') { await answerCallback(cbId); const v = await viewPosting(); return editMessage(chatId, messageId, v.text, v.keyboard); }
  if (data === 'nav:tpl') { await answerCallback(cbId); const v = await viewTemplates(); return editMessage(chatId, messageId, v.text, v.keyboard); }
  if (data === 'nav:set') { await answerCallback(cbId); const v = await viewSettings(); return editMessage(chatId, messageId, v.text, v.keyboard); }
  if (data === 'nav:short') { await answerCallback(cbId); const v = await viewShortener(); return editMessage(chatId, messageId, v.text, v.keyboard); }

  if (data === 'act:short:toggle') {
    const { getShortenerSettings, saveShortenerSettings } = await import('@/lib/shortener');
    const s = await getShortenerSettings();
    s.enabled = !s.enabled;
    await saveShortenerSettings(s);
    await answerCallback(cbId, s.enabled ? 'Ads ON' : 'Ads OFF');
    const v = await viewShortener();
    return editMessage(chatId, messageId, v.text, v.keyboard);
  }
  if (data.startsWith('act:short:freq:')) {
    const n = parseInt(data.split(':')[3], 10);
    const { getShortenerSettings, saveShortenerSettings } = await import('@/lib/shortener');
    const s = await getShortenerSettings();
    s.everyN = n;
    s.enabled = true; // choosing a frequency implies enabling ads
    await saveShortenerSettings(s);
    await answerCallback(cbId, `Ad on every ${s.everyN}ᵗʰ click`);
    const v = await viewShortener();
    return editMessage(chatId, messageId, v.text, v.keyboard);
  }

  // Scrape (parse act:scrape:<pages>:<which>)
  if (data.startsWith('act:scrape:')) {
    const [, , pagesStr, which] = data.split(':');
    await answerCallback(cbId, 'Starting…');
    await runScrape(chatId, parseInt(pagesStr) || 3, (which as 'all' | 'uf' | 'sb') || 'all');
    return;
  }

  // Cleanup
  if (data === 'act:clean:dedup') {
    await answerCallback(cbId, 'Working…');
    const { cleanupDuplicates } = await import('@/lib/scraper');
    const r = await cleanupDuplicates();
    return sendMessage(chatId, `🧽 Removed <b>${r.removed}</b> duplicate(s).`, { inline_keyboard: [backRow('nav:clean')] });
  }
  if (data === 'act:clean:invalid') {
    await answerCallback(cbId, 'Working…');
    const r = await cleanupInvalidCourses();
    return sendMessage(chatId, `🧯 Removed <b>${r.totalRemoved}</b> invalid course(s).`, { inline_keyboard: [backRow('nav:clean')] });
  }
  if (data === 'act:clean:purge') {
    await answerCallback(cbId);
    return editMessage(chatId, messageId, `⚠️ <b>Delete ALL courses?</b>\nThis cannot be undone.`, {
      inline_keyboard: [[{ text: '✅ Yes, purge everything', callback_data: 'act:clean:purgeyes' }], backRow('nav:clean')],
    });
  }
  if (data === 'act:clean:purgeyes') {
    await answerCallback(cbId, 'Purging…');
    const r = await purgeAllCourses();
    return editMessage(chatId, messageId, `🗑️ Purged <b>${r.removed}</b> course(s).`, { inline_keyboard: [backRow('nav:clean')] });
  }

  // Posting
  if (data === 'act:autopost') {
    const s = await getTelegramSettings();
    s.auto_post = !s.auto_post;
    await saveTelegramSettings(s);
    await answerCallback(cbId, `Auto-post ${s.auto_post ? 'ON' : 'OFF'}`);
    const v = await viewPosting();
    return editMessage(chatId, messageId, v.text, v.keyboard);
  }
  if (data === 'act:postnow') {
    await answerCallback(cbId, 'Posting…');
    await postNow(chatId);
    return;
  }

  // Channel management
  if (data.startsWith('ch:')) {
    const [, op, idxStr] = data.split(':');
    const idx = parseInt(idxStr);
    const s = await getTelegramSettings();
    const channels = s.channels || [];
    const ch = channels[idx];
    if (!ch) { await answerCallback(cbId, 'Channel not found'); const v = await viewChannels(); return editMessage(chatId, messageId, v.text, v.keyboard); }

    if (op === 'info') { await answerCallback(cbId, `${ch.name} · ${ch.id || 'no id'} · ${ch.active ? 'active' : 'inactive'}`); return; }
    if (op === 'tog') {
      ch.active = !ch.active; await saveTelegramSettings(s);
      await answerCallback(cbId, ch.active ? 'Enabled' : 'Disabled');
      const v = await viewChannels(); return editMessage(chatId, messageId, v.text, v.keyboard);
    }
    if (op === 'rm') {
      await answerCallback(cbId);
      return editMessage(chatId, messageId, `🗑 Remove channel <b>${escapeHtml(ch.name)}</b>?`, {
        inline_keyboard: [[{ text: '✅ Yes, remove', callback_data: `ch:rmyes:${idx}` }], backRow('nav:chan')],
      });
    }
    if (op === 'rmyes') {
      channels.splice(idx, 1); s.channels = channels; await saveTelegramSettings(s);
      await answerCallback(cbId, 'Removed');
      const v = await viewChannels(); return editMessage(chatId, messageId, v.text, v.keyboard);
    }
    if (op === 'lang') {
      await answerCallback(cbId);
      const rows: Btn[][] = [];
      for (let i = 0; i < LANGS.length; i += 4) {
        rows.push(LANGS.slice(i, i + 4).map((l) => ({ text: l, callback_data: `chsetlang:${idx}:${l}` })));
      }
      rows.push(backRow('nav:chan'));
      return editMessage(chatId, messageId, `🌐 Pick a language for <b>${escapeHtml(ch.name)}</b>:`, { inline_keyboard: rows });
    }
  }
  if (data.startsWith('chsetlang:')) {
    const [, idxStr, lang] = data.split(':');
    const idx = parseInt(idxStr);
    const s = await getTelegramSettings();
    if (s.channels?.[idx] && LANGS.includes(lang)) { s.channels[idx].language = lang; await saveTelegramSettings(s); }
    await answerCallback(cbId, `Language: ${lang}`);
    const v = await viewChannels(); return editMessage(chatId, messageId, v.text, v.keyboard);
  }

  // Prompts that need free-text input
  if (data.startsWith('ask:')) {
    const action = data.slice(4);
    // Add Channel uses the guided multi-step flow (name -> handle/id -> language).
    if (action === 'addch') {
      await setState(chatId, 'addch', JSON.stringify({ step: 'name' }));
      await answerCallback(cbId);
      return sendMessage(
        chatId,
        '➕ <b>Add Channel</b> (step 1 of 3)\n\nSend the channel <b>name</b>. Any text is fine — spaces or Arabic are OK.',
      );
    }
    await setState(chatId, action);
    await answerCallback(cbId);
    return editMessage(chatId, messageId, promptText(action), { inline_keyboard: [[{ text: '✖️ Cancel', callback_data: cancelTarget(action) }]] });
  }

  await answerCallback(cbId);
}

function cancelTarget(action: string): string {
  if (action === 'addch') return 'nav:chan';
  if (action === 'delay') return 'nav:post';
  if (action.startsWith('tpl')) return 'nav:tpl';
  if (action.startsWith('site') || action === 'perpage') return 'nav:set';
  if (action === 'shortfreq') return 'nav:short';
  return 'nav:main';
}

function promptText(action: string): string {
  switch (action) {
    case 'delay': return `⏱️ <b>Set delay</b>\nSend the number of seconds between posts (min 5). Example: <code>60</code>`;
    case 'tplen': return `✏️ <b>Set EN template</b>\nSend the new template text.\nPlaceholders: {title} {instructor} {rating} {students_count} {original_price} {language} {duration} {link}`;
    case 'tplar': return `✏️ <b>Set AR template</b>\nSend the new Arabic template text. Same placeholders as EN.`;
    case 'bcast': return `📨 <b>Broadcast</b>\nSend the message to deliver to all active channels.`;
    case 'sitename': return `🏷️ <b>Site name</b>\nSend the new site name.`;
    case 'sitedesc': return `🧾 <b>Site description</b>\nSend the new description.`;
    case 'perpage': return `📄 <b>Courses per page</b>\nSend a number (1–60). Example: <code>12</code>`;
    case 'shortfreq': return `🔗 <b>Ad frequency</b>\nSend a number N (1–100). An ad shows on every Nᵗʰ course click — the other clicks go direct. Example: <code>5</code> means 4 clean opens then 1 ad.`;
    default: return 'Send the value:';
  }
}

// --------------------------------------------------------------------
// Process a free-text reply for a pending action
// --------------------------------------------------------------------

async function processInput(chatId: string, action: string, extra: string, text: string) {
  const { getTelegramSettings, saveTelegramSettings, setSetting } = await import('@/lib/queries');

  // Guided Add Channel flow: name -> @handle/chat_id -> language -> save.
  // State is carried in `extra` (JSON) so names with spaces/Arabic work.
  if (action === 'addch') {
    let data: { step?: string; name?: string; id?: string } = {};
    try { data = JSON.parse(extra || '{}'); } catch { /* ignore */ }
    const step = data.step || 'name';

    if (step === 'name') {
      const name = text.trim();
      if (!name) return sendMessage(chatId, '❌ Please send a non-empty channel name.');
      await setState(chatId, 'addch', JSON.stringify({ step: 'id', name }));
      return sendMessage(
        chatId,
        `✅ Name saved: <b>${escapeHtml(name)}</b>\n\n➕ <b>Add Channel</b> (step 2 of 3)\n\nSend the channel <b>@handle</b> (e.g. <code>@mychannel</code>) or a numeric <b>chat_id</b>.`,
      );
    }

    if (step === 'id') {
      const id = text.trim();
      if (!id) return sendMessage(chatId, '❌ Please send a valid @handle or numeric chat_id.');
      await setState(chatId, 'addch', JSON.stringify({ step: 'lang', name: data.name, id }));
      return sendMessage(
        chatId,
        `✅ ID saved: <code>${escapeHtml(id)}</code>\n\n➕ <b>Add Channel</b> (step 3 of 3)\n\nSend the <b>language code</b>, for example <code>en</code> or <code>ar</code>.\nSupported: ${LANGS.join(', ')}`,
      );
    }

    // step === 'lang'
    const lang = text.trim().toLowerCase();
    if (!LANGS.includes(lang)) {
      return sendMessage(chatId, `❌ Invalid language code. Send one of: ${LANGS.join(', ')}`);
    }
    const name = data.name || 'Channel';
    const id = data.id || '';
    const s = await getTelegramSettings();
    s.channels = [...(s.channels || []), { name, id, active: true, language: lang }];
    await saveTelegramSettings(s);
    await clearState(chatId);
    return sendMessage(
      chatId,
      `✅ <b>Channel saved</b>\n\n📛 Name: <b>${escapeHtml(name)}</b>\n🔗 ID: <code>${escapeHtml(id)}</code>\n🌐 Language: <b>${lang}</b>`,
      { inline_keyboard: [[{ text: '📡 View channels', callback_data: 'nav:chan' }]] },
    );
  }

  // All other inputs are single-step.
  await clearState(chatId);

  if (action === 'bcast') { await broadcast(chatId, text); return; }

  if (action === 'delay') {
    const sec = parseInt(text);
    if (isNaN(sec) || sec < 5) return reply(chatId, '❌ Minimum is 5 seconds.', 'nav:post');
    const s = await getTelegramSettings(); s.post_delay_ms = sec * 1000; await saveTelegramSettings(s);
    return reply(chatId, `✅ Delay set to ${sec}s.`, 'nav:post');
  }

  if (action === 'tplen' || action === 'tplar') {
    const s = await getTelegramSettings();
    if (action === 'tplen') s.message_template = text; else s.message_template_ar = text;
    await saveTelegramSettings(s);
    return reply(chatId, '✅ Template updated.', 'nav:tpl');
  }

  if (action === 'sitename') { await setSetting('site_name', text.trim()); return reply(chatId, '✅ Site name updated.', 'nav:set'); }
  if (action === 'sitedesc') { await setSetting('site_description', text.trim()); return reply(chatId, '✅ Description updated.', 'nav:set'); }
  if (action === 'perpage') {
    const n = parseInt(text);
    if (isNaN(n) || n < 1 || n > 60) return reply(chatId, '❌ Send a number 1–60.', 'nav:set');
    await setSetting('courses_per_page', String(n));
    return reply(chatId, `✅ Courses per page set to ${n}.`, 'nav:set');
  }
  if (action === 'shortfreq') {
    const n = parseInt(text);
    if (isNaN(n) || n < 1 || n > 100) return reply(chatId, '❌ Send a number 1–100.', 'nav:short');
    const { getShortenerSettings, saveShortenerSettings } = await import('@/lib/shortener');
    const s = await getShortenerSettings();
    s.everyN = n; s.enabled = true;
    await saveShortenerSettings(s);
    return reply(chatId, `✅ Ad shows on every ${n}ᵗʰ course click.`, 'nav:short');
  }
}

function reply(chatId: string, text: string, back: string) {
  return sendMessage(chatId, text, { inline_keyboard: [backRow(back)] });
}

// --------------------------------------------------------------------
// Main menu — persistent Reply Keyboard label handlers
// Each label is a normal text message; we open the matching section.
// Detailed actions inside a section still use inline keyboards.
// --------------------------------------------------------------------

async function handleMenuLabel(chatId: string, text: string): Promise<boolean> {
  switch (text) {
    case '📊 Statistics': {
      await clearState(chatId);
      const v = await viewStats();
      await sendMessage(chatId, v.text, v.keyboard);
      return true;
    }
    case '📤 Posting': {
      await clearState(chatId);
      const v = await viewPosting();
      await sendMessage(chatId, v.text, v.keyboard);
      return true;
    }
    case '📡 Channels': {
      await clearState(chatId);
      const v = await viewChannels();
      await sendMessage(chatId, v.text, v.keyboard);
      return true;
    }
    case '🔄 Scraper': {
      await clearState(chatId);
      const v = viewScrape();
      await sendMessage(chatId, v.text, v.keyboard);
      return true;
    }
    case '📝 Templates': {
      await clearState(chatId);
      const v = await viewTemplates();
      await sendMessage(chatId, v.text, v.keyboard);
      return true;
    }
    case '🧹 Cleanup': {
      await clearState(chatId);
      const v = viewClean();
      await sendMessage(chatId, v.text, v.keyboard);
      return true;
    }
    case '⚙️ Settings': {
      await clearState(chatId);
      const v = await viewSettings();
      await sendMessage(chatId, v.text, v.keyboard);
      return true;
    }
    case '🔗 Link Ads': {
      await clearState(chatId);
      const v = await viewShortener();
      await sendMessage(chatId, v.text, v.keyboard);
      return true;
    }
    case '➕ Add Channel': {
      await setState(chatId, 'addch', JSON.stringify({ step: 'name' }));
      await sendMessage(
        chatId,
        '➕ <b>Add Channel</b> (step 1 of 3)\n\nSend the channel <b>name</b>. Any text is fine — spaces or Arabic are OK.',
      );
      return true;
    }
    case '📨 Broadcast': {
      await setState(chatId, 'bcast');
      await sendMessage(chatId, '📨 <b>Broadcast</b>\n\nSend the message to deliver to all active channels.');
      return true;
    }
    case '📖 Help': {
      await sendWithReplyKeyboard(chatId, helpText());
      return true;
    }
    default:
      return false;
  }
}

// --------------------------------------------------------------------
// Webhook entry point
// --------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Inline button taps
    if (body.callback_query) {
      const cq = body.callback_query;
      const chatId = String(cq.message?.chat?.id);
      if (!isAuthorized(chatId)) { await answerCallback(cq.id, 'Unauthorized'); return NextResponse.json({ ok: true }); }
      await handleCallback(chatId, cq.message.message_id, String(cq.data || ''), cq.id);
      return NextResponse.json({ ok: true });
    }

    const message = body.message;
    if (!message || !message.text || !message.chat) return NextResponse.json({ ok: true });

    const chatId = String(message.chat.id);
    const text: string = message.text.trim();

    if (!isAuthorized(chatId)) {
      await sendMessage(chatId, '🚫 Unauthorized. Your chat ID is not in the allowed list.');
      return NextResponse.json({ ok: true });
    }

    // 1) Main-menu reply-keyboard buttons (these arrive as normal text messages).
    if (await handleMenuLabel(chatId, text)) return NextResponse.json({ ok: true });

    // 2) Slash commands.
    if (text.startsWith('/')) {
      const cmd = text.split(' ')[0].toLowerCase();
      if (cmd === '/start' || cmd === '/menu') {
        await clearState(chatId);
        await sendWithReplyKeyboard(chatId, welcomeText());
      } else if (cmd === '/help') {
        await sendWithReplyKeyboard(chatId, helpText());
      } else if (cmd === '/stats') {
        const v = await viewStats(); await sendMessage(chatId, v.text, v.keyboard);
      } else if (cmd === '/scrape') {
        await runScrape(chatId, 3, 'all');
      } else if (cmd === '/post') {
        await postNow(chatId);
      } else {
        await sendWithReplyKeyboard(chatId, '❓ Unknown command. Use the keyboard below.');
      }
      return NextResponse.json({ ok: true });
    }

    // 3) A pending guided / free-text input (e.g. the Add Channel steps).
    const state = await getState(chatId);
    if (state) { await processInput(chatId, state.action, state.extra, text); return NextResponse.json({ ok: true }); }

    // 4) Fallback — re-show the persistent keyboard.
    await sendWithReplyKeyboard(chatId, '⌨️ Use the keyboard below to control the bot.');
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[AdminBot] Error:', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Learn Plus Courses Admin Bot webhook' });
}
