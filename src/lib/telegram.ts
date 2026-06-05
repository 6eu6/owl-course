import { getTelegramSettings, getUnpostedCourses, markCourseTelegramPosted, logTelegramMessage } from './mongodb';

const TELEGRAM_API = 'https://api.telegram.org';

// Language-specific field label mappings for message templates
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
  return LANGUAGE_LABELS[lang] || LANGUAGE_LABELS['en'] || LANGUAGE_LABELS['en'];
}

// Build a localized template if no custom template is provided for the language
function buildLocalizedTemplate(lang: string): string {
  const labels = getLabels(lang);
  if (lang === 'ar') {
    return `📚 {title}\n\n👤 {instructor_label}: {instructor}\n⭐ {rating_label}: {rating}\n👥 {students_count_label}: {students_count}\n\n🔗 {link_label}: {link}`;
  }
  return `📚 {title}\n\n👤 {instructor_label}: {instructor}\n⭐ {rating_label}: {rating}\n👥 {students_count_label}: {students_count}\n\n🔗 {link_label}: {link}`;
}

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

// Format course message from template with language-specific labels
function formatMessage(template: string, course: Record<string, unknown>, channelLanguage: string): string {
  const labels = getLabels(channelLanguage);

  // Start with the provided template
  let message = template;

  // Replace field placeholders with course values
  message = message.replace(/{title}/g, String(course.title || 'Untitled Course'));
  message = message.replace(/{instructor}/g, String(course.instructor || 'Unknown'));
  message = message.replace(/{category}/g, String(course.category || 'General'));
  message = message.replace(/{rating}/g, String(course.rating || 'N/A'));
  message = message.replace(/{students_count}/g, String(course.students_count || 'N/A'));
  message = message.replace(/{original_price}/g, String(course.original_price || 'Free'));
  message = message.replace(/{language}/g, String(course.language || 'English'));
  message = message.replace(/{duration}/g, String(course.duration || 'Self-paced'));

  // Build the enrollment link: use the site URL with the course slug for branded links,
  // or fall back to the Udemy coupon URL
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  const slug = String(course.slug || '');
  const udemyUrl = String(course.udemy_url || '');
  const link = (siteUrl && slug) ? `${siteUrl}/course/${slug}` : udemyUrl;

  message = message.replace(/{link}/g, link);
  message = message.replace(/{site_url}/g, siteUrl);

  // Replace label placeholders with localized field names
  message = message.replace(/{instructor_label}/g, labels.instructor);
  message = message.replace(/{category_label}/g, labels.category);
  message = message.replace(/{rating_label}/g, labels.rating);
  message = message.replace(/{students_count_label}/g, labels.students_count);
  message = message.replace(/{original_price_label}/g, labels.original_price);
  message = message.replace(/{language_label}/g, labels.language);
  message = message.replace(/{duration_label}/g, labels.duration);
  message = message.replace(/{link_label}/g, labels.link);

  return message;
}

// Post a single course to all active channels with per-channel language support
export async function postCourseToTelegram(course: Record<string, unknown>, settings: Record<string, unknown>): Promise<{ success: boolean; channels: string[] }> {
  const botToken = String(settings.bot_token || '');
  const channels = (settings.channels as Array<{ id: string; active: boolean; name: string; language: string }>) || [];
  const defaultTemplate = String(settings.message_template || '{title}\n{link}');
  const arabicTemplate = String((settings as Record<string, unknown>).message_template_ar || defaultTemplate);

  if (!botToken) return { success: false, channels: [] };

  const activeChannels = channels.filter((c: { active: boolean }) => c.active);
  const sentChannels: string[] = [];
  let allSuccess = true;

  for (const channel of activeChannels) {
    if (!channel.id) continue;

    // Pick template based on channel language
    const lang = channel.language || 'en';
    let template: string;

    if (lang === 'ar' && arabicTemplate) {
      template = arabicTemplate;
    } else if (lang === 'en' || !channels.some((c: { language: string }) => c.language && c.language !== 'en')) {
      template = defaultTemplate;
    } else {
      // For other languages, use the default template but with localized labels
      template = buildLocalizedTemplate(lang);
    }

    const message = formatMessage(template, course, lang);
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
  const settings = await getTelegramSettings();
  if (!settings.bot_token || !settings.auto_post) {
    return { posted: 0, errors: ['Telegram not configured or auto-post disabled'] };
  }

  const unposted = await getUnpostedCourses(limit);
  const errors: string[] = [];
  let posted = 0;

  for (const course of unposted) {
    const result = await postCourseToTelegram(course as unknown as Record<string, unknown>, settings as unknown as Record<string, unknown>);
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
  }

  return { posted, errors };
}

// Test Telegram connection
export async function testTelegramConnection(botToken: string, chatId: string): Promise<{ success: boolean; message: string }> {
  try {
    const ok = await sendMessage(botToken, chatId, '🧪 Test message from OWL COURSE\n\n✅ Connection successful!');
    return ok
      ? { success: true, message: 'Test message sent successfully!' }
      : { success: false, message: 'Failed to send message. Check Bot Token and Channel ID.' };
  } catch (e) {
    return { success: false, message: `Error: ${e}` };
  }
}
