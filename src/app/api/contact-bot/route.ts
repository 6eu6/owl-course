import { NextResponse } from 'next/server';

// =====================================================================
// Public contact / onboarding bot (@FreeLearningHub_P_bot — the PUBLISHING
// bot token). Anyone may use it. It only ever does three safe things:
//   1) pick a language, 2) contact the owner, 3) register their own channel
//      so new free courses auto-post there.
// It NEVER exposes stats, the scraper, settings, or any sensitive data —
// that is exclusively the ID-restricted admin bot.
// =====================================================================

const API = 'https://api.telegram.org';

function token(): string {
  return process.env.TELEGRAM_BOT_TOKEN || '';
}
function botId(): string {
  return token().split(':')[0] || '';
}
function adminIds(): string[] {
  return (process.env.ADMIN_CHAT_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
}
function isAdmin(chatId: string): boolean {
  return adminIds().some((id) => id === String(chatId));
}

type Btn = { text: string; callback_data?: string; url?: string };
type Keyboard = { inline_keyboard: Btn[][] };

async function call(method: string, payload: Record<string, unknown>): Promise<unknown> {
  const t = token();
  if (!t) return null;
  try {
    const res = await fetch(`${API}/bot${t}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}
function send(chatId: string, text: string, keyboard?: Keyboard) {
  return call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...(keyboard ? { reply_markup: keyboard } : {}) });
}
function edit(chatId: string, messageId: number, text: string, keyboard?: Keyboard) {
  return call('editMessageText', { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', disable_web_page_preview: true, ...(keyboard ? { reply_markup: keyboard } : {}) });
}
function answer(id: string, text?: string) {
  return call('answerCallbackQuery', { callback_query_id: id, ...(text ? { text } : {}) });
}

// --- short-lived per-chat state (DB-backed) ---
async function setState(chatId: string, data: Record<string, unknown>) {
  const { setSetting } = await import('@/lib/queries');
  await setSetting(`cbstate:${chatId}`, JSON.stringify({ ...data, ts: Date.now() }));
}
async function getState(chatId: string): Promise<Record<string, unknown> | null> {
  const { getSetting } = await import('@/lib/queries');
  const raw = await getSetting(`cbstate:${chatId}`);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (Date.now() - (s.ts || 0) > 10 * 60 * 1000) return null;
    return s;
  } catch {
    return null;
  }
}
async function clearState(chatId: string) {
  const { setSetting } = await import('@/lib/queries');
  await setSetting(`cbstate:${chatId}`, '');
}

// --- bilingual copy ---
type Lang = 'ar' | 'en';
const T = {
  en: {
    pickLang: '\u{1F310} Please choose your language:',
    menu: '\u{1F44B} <b>Welcome to Learn Plus</b>\n\nHow can we help you?',
    contact: '✉️ Contact us',
    addChannel: '\u{1F4E3} Add the bot to my channel',
    contactPrompt: '✍️ Please type your message and send it here. We will get back to you soon.',
    contactSent: '✅ Your message was sent. Thank you — we will reply soon.',
    guide:
      '\u{1F4E3} <b>Auto-post free courses to your channel</b>\n\n' +
      'Follow these quick steps:\n\n' +
      '1️⃣ Add <b>@FreeLearningHub_P_bot</b> as an <b>administrator</b> to your channel, with the <b>“Post messages”</b> permission.\n' +
      '2️⃣ Send me your channel <b>@username</b> here (e.g. <code>@mychannel</code>), or forward any post from the channel.\n' +
      '3️⃣ Choose the posting language.\n\n' +
      'That’s it — new free courses will then be posted to your channel automatically.',
    askChannel: '\u{1F517} Send your channel @username now (e.g. <code>@mychannel</code>), or forward a post from it.',
    notChannel: '❌ That does not look like a channel. Add the bot as admin first, then send the channel @username or forward a post from it.',
    notAdmin: '❌ I am not an admin of that channel yet (with post permission). Please add me as an administrator, then try again.',
    pickPostLang: '\u{1F310} Which language should I post in to this channel?',
    added: (name: string) => `✅ <b>${name}</b> is connected! New free courses will be posted there automatically.`,
    backMenu: '⬅️ Menu',
    err: '⚠️ Something went wrong. Please try again.',
  },
  ar: {
    pickLang: '\u{1F310} الرجاء اختيار لغتك:',
    menu: '\u{1F44B} <b>مرحباً بك في Learn Plus</b>\n\nكيف يمكننا مساعدتك؟',
    contact: '✉️ تواصل معنا',
    addChannel: '\u{1F4E3} إضافة البوت إلى قناتي',
    contactPrompt: '✍️ اكتب رسالتك وأرسلها هنا، وسنرد عليك قريباً.',
    contactSent: '✅ تم إرسال رسالتك. شكراً لك — سنرد عليك قريباً.',
    guide:
      '\u{1F4E3} <b>نشر الكورسات المجانية تلقائياً في قناتك</b>\n\n' +
      'اتبع هذه الخطوات السريعة:\n\n' +
      '1️⃣ أضف <b>@FreeLearningHub_P_bot</b> <b>مشرفاً</b> في قناتك مع صلاحية <b>«نشر الرسائل»</b>.\n' +
      '2️⃣ أرسل لي <b>@اسم قناتك</b> هنا (مثل <code>@mychannel</code>)، أو حوّل أي منشور من القناة.\n' +
      '3️⃣ اختر لغة النشر.\n\n' +
      'وهذا كل شيء — ستُنشر الكورسات المجانية الجديدة في قناتك تلقائياً.',
    askChannel: '\u{1F517} أرسل الآن @اسم قناتك (مثل <code>@mychannel</code>)، أو حوّل منشوراً منها.',
    notChannel: '❌ هذا لا يبدو قناة. أضف البوت مشرفاً أولاً، ثم أرسل @اسم القناة أو حوّل منشوراً منها.',
    notAdmin: '❌ لست مشرفاً في تلك القناة بعد (مع صلاحية النشر). أضفني مشرفاً ثم حاول مرة أخرى.',
    pickPostLang: '\u{1F310} بأي لغة أنشر في هذه القناة؟',
    added: (name: string) => `✅ تم ربط <b>${name}</b>! ستُنشر الكورسات المجانية الجديدة فيها تلقائياً.`,
    backMenu: '⬅️ القائمة',
    err: '⚠️ حدث خطأ ما. حاول مرة أخرى.',
  },
} as const;

function langKb(): Keyboard {
  return { inline_keyboard: [[{ text: 'العربية \u{1F1F8}\u{1F1E6}', callback_data: 'lang:ar' }, { text: 'English \u{1F1EC}\u{1F1E7}', callback_data: 'lang:en' }]] };
}
function menuKb(l: Lang): Keyboard {
  return {
    inline_keyboard: [
      [{ text: T[l].contact, callback_data: 'go:contact' }],
      [{ text: T[l].addChannel, callback_data: 'go:addch' }],
    ],
  };
}
function postLangKb(): Keyboard {
  return { inline_keyboard: [[{ text: 'العربية', callback_data: 'plang:ar' }, { text: 'English', callback_data: 'plang:en' }]] };
}

async function langOf(chatId: string): Promise<Lang> {
  const s = await getState(chatId);
  return (s?.lang as Lang) || 'en';
}

// --- channel verification + registration ---
async function verifyChannel(handleOrId: string): Promise<{ ok: boolean; id?: string; title?: string; reason?: 'notchannel' | 'notadmin' }> {
  const chat = (await call('getChat', { chat_id: handleOrId })) as { ok?: boolean; result?: { id: number; type: string; title?: string; username?: string } } | null;
  if (!chat?.ok || !chat.result || chat.result.type !== 'channel') return { ok: false, reason: 'notchannel' };
  const member = (await call('getChatMember', { chat_id: chat.result.id, user_id: botId() })) as { ok?: boolean; result?: { status?: string; can_post_messages?: boolean } } | null;
  const st = member?.result?.status;
  const canPost = member?.result?.can_post_messages !== false;
  if (!(st === 'administrator' && canPost)) return { ok: false, reason: 'notadmin' };
  const id = chat.result.username ? `@${chat.result.username}` : String(chat.result.id);
  return { ok: true, id, title: chat.result.title || id };
}

async function registerChannel(name: string, id: string, postLang: Lang) {
  const { getTelegramSettings, saveTelegramSettings } = await import('@/lib/queries');
  const s = await getTelegramSettings();
  const exists = (s.channels || []).some((c) => String(c.id) === String(id));
  if (!exists) {
    s.channels = [...(s.channels || []), { name, id, active: true, language: postLang }];
    await saveTelegramSettings(s);
  }
}

// --- handlers ---
async function handleCallback(chatId: string, messageId: number, data: string, cbId: string) {
  if (data.startsWith('lang:')) {
    const lang = data.slice(5) as Lang;
    await setState(chatId, { lang });
    await answer(cbId);
    return edit(chatId, messageId, T[lang].menu, menuKb(lang));
  }
  const l = await langOf(chatId);

  if (data === 'go:contact') {
    await setState(chatId, { lang: l, mode: 'contact' });
    await answer(cbId);
    return edit(chatId, messageId, T[l].contactPrompt, { inline_keyboard: [[{ text: T[l].backMenu, callback_data: 'go:menu' }]] });
  }
  if (data === 'go:addch') {
    await setState(chatId, { lang: l, mode: 'addch' });
    await answer(cbId);
    await edit(chatId, messageId, T[l].guide);
    return send(chatId, T[l].askChannel);
  }
  if (data === 'go:menu') {
    await setState(chatId, { lang: l });
    await answer(cbId);
    return edit(chatId, messageId, T[l].menu, menuKb(l));
  }
  if (data.startsWith('plang:')) {
    const postLang = data.slice(6) as Lang;
    const s = await getState(chatId);
    const chId = s?.pendingChannelId as string | undefined;
    const chName = (s?.pendingChannelName as string | undefined) || chId || '';
    await answer(cbId);
    if (!chId) return edit(chatId, messageId, T[l].err, menuKb(l));
    await registerChannel(chName, chId, postLang);
    await clearState(chatId);
    return edit(chatId, messageId, T[l].added(chName), { inline_keyboard: [[{ text: T[l].backMenu, callback_data: 'go:menu' }]] });
  }
  await answer(cbId);
}

async function handleMessage(chatId: string, text: string, msg: Record<string, unknown>) {
  // Admin reply relay: /reply <userId> <message>  (admins only)
  if (text.startsWith('/reply') && isAdmin(chatId)) {
    const m = text.match(/^\/reply\s+(\d+)\s+([\s\S]+)$/);
    if (m) {
      await send(m[1], `\u{1F4AC} ${m[2]}`);
      await send(chatId, `✅ Sent to ${m[1]}.`);
    } else {
      await send(chatId, 'Usage: /reply <userId> <message>');
    }
    return;
  }

  if (text === '/start' || text === '/menu') {
    await setState(chatId, {});
    return send(chatId, T.en.pickLang, langKb());
  }

  const state = await getState(chatId);
  const l = (state?.lang as Lang) || 'en';

  // Contact mode → forward to owner
  if (state?.mode === 'contact' && text && !text.startsWith('/')) {
    const from = msg.from as { first_name?: string; username?: string } | undefined;
    const name = from?.first_name || 'User';
    const uname = from?.username ? `@${from.username}` : '';
    for (const admin of adminIds()) {
      await send(admin, `\u{1F4E8} <b>New contact message</b>\nFrom: ${name} ${uname} (id: <code>${chatId}</code>)\n\n${text}\n\n↩️ Reply with:\n<code>/reply ${chatId} your message</code>`);
    }
    await clearState(chatId);
    return send(chatId, T[l].contactSent, menuKb(l));
  }

  // Add-channel mode → expect @username or a forwarded channel post
  if (state?.mode === 'addch') {
    let handle = '';
    const fwd = msg.forward_from_chat as { id?: number; type?: string } | undefined;
    if (fwd?.type === 'channel' && fwd.id) handle = String(fwd.id);
    else {
      const mm = text.match(/@([A-Za-z0-9_]{4,})/);
      if (mm) handle = `@${mm[1]}`;
    }
    if (!handle) return send(chatId, T[l].notChannel);

    const v = await verifyChannel(handle);
    if (!v.ok) return send(chatId, v.reason === 'notadmin' ? T[l].notAdmin : T[l].notChannel);

    await setState(chatId, { lang: l, mode: 'addch', pendingChannelId: v.id, pendingChannelName: v.title });
    return send(chatId, T[l].pickPostLang, postLangKb());
  }

  // Default
  await setState(chatId, {});
  return send(chatId, T.en.pickLang, langKb());
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.callback_query) {
      const cq = body.callback_query;
      const chatId = String(cq.message?.chat?.id);
      if (cq.message?.chat?.type === 'private') {
        await handleCallback(chatId, cq.message.message_id, String(cq.data || ''), cq.id);
      } else {
        await answer(cq.id);
      }
      return NextResponse.json({ ok: true });
    }

    const msg = body.message;
    // Only handle private chats; ignore channel/group noise.
    if (!msg || msg.chat?.type !== 'private') return NextResponse.json({ ok: true });

    const chatId = String(msg.chat.id);
    const text: string = (msg.text || '').trim();
    await handleMessage(chatId, text, msg);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[ContactBot] Error:', e);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Learn Plus contact bot webhook' });
}
