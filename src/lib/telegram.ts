import { getTelegramSettings, getUnpostedCourses, markCourseTelegramPosted, logTelegramMessage } from './mongodb';

const TELEGRAM_API = 'https://api.telegram.org';

// Default delay between posting messages (in ms)
const DEFAULT_POST_DELAY_MS = 60_000; // 1 minute

// ============================================
// Language-specific field label mappings
// ============================================

const LANGUAGE_LABELS: Record<string, Record<string, string>> = {
  en: {
    instructor: 'Instructor',
    category: 'Category',
    rating: 'Rating',
    students_count: 'Students',
    original_price: 'Price',
    language: 'Language',
    duration: 'Duration',
    link: 'Enroll Free',
  },
  ar: {
    instructor: 'المدرب',
    category: 'التصنيف',
    rating: 'التقييم',
    students_count: 'الطلاب',
    original_price: 'السعر',
    language: 'اللغة',
    duration: 'المدة',
    link: 'سجل مجاناً',
  },
  es: {
    instructor: 'Instructor',
    category: 'Categoría',
    rating: 'Calificación',
    students_count: 'Estudiantes',
    original_price: 'Precio',
    language: 'Idioma',
    duration: 'Duración',
    link: 'Inscríbete Gratis',
  },
  fr: {
    instructor: 'Instructeur',
    category: 'Catégorie',
    rating: 'Note',
    students_count: 'Étudiants',
    original_price: 'Prix',
    language: 'Langue',
    duration: 'Durée',
    link: "S'inscrire Gratuitement",
  },
  pt: {
    instructor: 'Instrutor',
    category: 'Categoria',
    rating: 'Avaliação',
    students_count: 'Estudantes',
    original_price: 'Preço',
    language: 'Idioma',
    duration: 'Duração',
    link: 'Inscreva-se Grátis',
  },
  tr: {
    instructor: 'Eğitmen',
    category: 'Kategori',
    rating: 'Puan',
    students_count: 'Öğrenci',
    original_price: 'Fiyat',
    language: 'Dil',
    duration: 'Süre',
    link: 'Ücretsiz Kaydol',
  },
  hi: {
    instructor: 'Instructor',
    category: 'Category',
    rating: 'Rating',
    students_count: 'Students',
    original_price: 'Price',
    language: 'Language',
    duration: 'Duration',
    link: 'Enroll Free',
  },
  zh: {
    instructor: '讲师',
    category: '分类',
    rating: '评分',
    students_count: '学生',
    original_price: '价格',
    language: '语言',
    duration: '时长',
    link: '免费注册',
  },
  ja: {
    instructor: '講師',
    category: 'カテゴリ',
    rating: '評価',
    students_count: '受講生',
    original_price: '価格',
    language: '言語',
    duration: '時間',
    link: '無料で受講',
  },
  ko: {
    instructor: '강사',
    category: '카테고리',
    rating: '평점',
    students_count: '수강생',
    original_price: '가격',
    language: '언어',
    duration: '시간',
    link: '무료 등록',
  },
  de: {
    instructor: 'Dozent',
    category: 'Kategorie',
    rating: 'Bewertung',
    students_count: 'Schüler',
    original_price: 'Preis',
    language: 'Sprache',
    duration: 'Dauer',
    link: 'Kostenlos Anmelden',
  },
  ru: {
    instructor: 'Инструктор',
    category: 'Категория',
    rating: 'Рейтинг',
    students_count: 'Студенты',
    original_price: 'Цена',
    language: 'Язык',
    duration: 'Длительность',
    link: 'Записаться бесплатно',
  },
};

function getLabels(lang: string): Record<string, string> {
  return LANGUAGE_LABELS[lang] || LANGUAGE_LABELS['en'];
}

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

function formatCourseMessageHtml(
  course: Record<string, unknown>,
  channelLanguage: string
): string {
  const labels = getLabels(channelLanguage);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  const slug = String(course.slug || '');
  const courseUrl = (siteUrl && slug) ? `${siteUrl}/course/${slug}` : String(course.udemy_url || '');

  const title = String(course.title || 'Untitled Course');
  const instructor = String(course.instructor || 'Unknown');
  const rating = course.rating ? String(course.rating) : 'N/A';
  const studentsCount = course.students_count
    ? Number(course.students_count).toLocaleString()
    : 'N/A';
  const originalPrice = String(course.original_price || 'Free');
  const language = String(course.language || 'English');
  const duration = String(course.duration || 'Self-paced');

  const message =
    `<b>📚 ${title}</b>\n\n` +
    `👤 <b>${labels.instructor}:</b> ${instructor}\n` +
    `⭐ <b>${labels.rating}:</b> ${rating}/5 ⭐\n` +
    `👥 <b>${labels.students_count}:</b> ${studentsCount}\n` +
    `🏷️ <b>${labels.original_price}:</b> <s>$${originalPrice}</s> → FREE\n` +
    `🌍 <b>${labels.language}:</b> ${language}\n` +
    `⏱️ <b>${labels.duration}:</b> ${duration}\n\n` +
    `🔗 ${courseUrl}`;

  return message;
}

// Build inline keyboard button pointing to site course page
function buildInlineKeyboard(course: Record<string, unknown>): Record<string, unknown> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  const slug = String(course.slug || '');
  const courseUrl = (siteUrl && slug) ? `${siteUrl}/course/${slug}` : '';

  if (!courseUrl) return {};

  return {
    inline_keyboard: [
      [
        {
          text: `🚀 Enroll Free → ${siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}/course/${slug}`,
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
  const channels = (settings.channels as Array<{ id: string; active: boolean; name: string; language: string }>) || [];

  if (!botToken) return { success: false, channels: [] };

  const activeChannels = channels.filter((c: { active: boolean }) => c.active);
  const sentChannels: string[] = [];
  let allSuccess = true;

  const messageHtml = formatCourseMessageHtml(course, 'en');
  const keyboard = buildInlineKeyboard(course);

  for (const channel of activeChannels) {
    if (!channel.id) continue;

    const lang = channel.language || 'en';
    const channelMessage = lang === 'en'
      ? messageHtml
      : formatCourseMessageHtml(course, lang);

    const ok = await sendMessage(botToken, channel.id, channelMessage, 'HTML', keyboard);

    if (ok) {
      sentChannels.push(channel.name);
    } else {
      allSuccess = false;
    }
  }

  return { success: allSuccess && sentChannels.length > 0, channels: sentChannels };
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
      course as unknown as Record<string, unknown>,
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
      '🧪 Test message from OWL COURSE\n\n✅ Connection successful!'
    );
    return ok
      ? { success: true, message: 'Test message sent successfully!' }
      : { success: false, message: 'Failed to send message. Check Bot Token and Channel ID.' };
  } catch (e) {
    return { success: false, message: `Error: ${e}` };
  }
}
