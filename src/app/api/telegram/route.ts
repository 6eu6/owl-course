import { NextResponse } from 'next/server';
import {
  getTelegramSettings,
  saveTelegramSettings,
  getRecentTelegramMessages,
  verifyAdminPassword,
  TelegramSettingsConfig,
} from '@/lib/mongodb';
import {
  postCourseToTelegram,
  testTelegramConnection,
  autoPostToTelegram,
} from '@/lib/telegram';
import { getCourseBySlug, getUnpostedCourses } from '@/lib/mongodb';

// GET /api/telegram - Get Telegram settings, recent messages, and status
export async function GET() {
  try {
    const settings = await getTelegramSettings();
    const messages = await getRecentTelegramMessages(20);
    const token = process.env.TELEGRAM_BOT_TOKEN || settings.bot_token;

    // Check if configured
    const configured = !!(token && settings.channels.some((c) => c.active && c.id));

    return NextResponse.json({
      success: true,
      configured,
      settings: {
        bot_token: token ? '****' + token.slice(-6) : '',
        channels: settings.channels.map((c) => ({
          name: c.name,
          id: c.id ? (c.id.startsWith('@') ? c.id : '@' + c.id) : c.id,
          active: c.active,
          language: c.language || 'en',
        })),
        auto_post: settings.auto_post,
        message_template: settings.message_template,
        message_template_ar: settings.message_template_ar || '',
      },
      messages,
    });
  } catch (e) {
    console.error('Telegram GET error:', e);
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}

// POST /api/telegram - Handle Telegram actions (admin protected)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, password } = body;

    // Verify admin password for all POST actions
    const isValid = await verifyAdminPassword(password);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid admin password' },
        { status: 401 }
      );
    }

    // --- Save Settings ---
    if (action === 'save_settings') {
      const { channels, auto_post, message_template, message_template_ar } = body;

      // Bot token comes from env, not from client
      const botToken = process.env.TELEGRAM_BOT_TOKEN || '';

      const settings: TelegramSettingsConfig = {
        bot_token: botToken,
        channels: Array.isArray(channels)
          ? channels.map((c: { name?: string; id?: string; active?: boolean; language?: string }) => ({
              name: String(c.name || 'Unnamed'),
              id: String(c.id || ''),
              active: c.active !== false,
              language: String(c.language || 'en'),
            }))
          : [{ name: 'Main Channel', id: '', active: true, language: 'en' }],
        auto_post: Boolean(auto_post),
        message_template: String(message_template || '{title}\n\nInstructor: {instructor}\nRating: {rating}\nStudents: {students_count}\n\n{link}'),
        message_template_ar: String(message_template_ar || '{title}\n\nالمدرب: {instructor}\nالتقييم: {rating}\nالطلاب: {students_count}\n\n{link}'),
      };

      await saveTelegramSettings(settings);

      return NextResponse.json({
        success: true,
        message: 'Telegram settings saved successfully',
      });
    }

    // --- Test Connection ---
    if (action === 'test') {
      const { channel_id } = body;
      if (!channel_id) {
        return NextResponse.json(
          { success: false, error: 'channel_id is required' },
          { status: 400 }
        );
      }

      const settings = await getTelegramSettings();
      const token = process.env.TELEGRAM_BOT_TOKEN || settings.bot_token;
      if (!token) {
        return NextResponse.json(
          { success: false, error: 'Bot token not configured. Set TELEGRAM_BOT_TOKEN env variable.' },
          { status: 400 }
        );
      }

      const testResult = await testTelegramConnection(token, String(channel_id));
      return NextResponse.json({
        success: testResult.success,
        message: testResult.message,
      });
    }

    // --- Post a Specific Course ---
    if (action === 'post_course') {
      const { course_id, slug } = body;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let course: any = null;
      if (slug) {
        course = await getCourseBySlug(String(slug));
      } else if (course_id) {
        const { db } = await import('@/lib/db');
        course = await db.course.findUnique({ where: { id: String(course_id) } });
      }

      if (!course) {
        return NextResponse.json(
          { success: false, error: 'Course not found' },
          { status: 404 }
        );
      }

      const settings = await getTelegramSettings();
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
        const { markCourseTelegramPosted, logTelegramMessage } = await import('@/lib/mongodb');
        await markCourseTelegramPosted(course.id);
        await logTelegramMessage({
          courseId: course.id,
          courseTitle: course.title,
          channels: result.channels,
          status: 'sent',
        });
      }

      return NextResponse.json({
        success: result.success,
        message: result.success
          ? `Course posted to ${result.channels.length} channel(s): ${result.channels.join(', ')}`
          : 'Failed to post course to any channel',
        channels: result.channels,
      });
    }

    // --- Auto-post unposted courses ---
    if (action === 'auto_post') {
      const limit = parseInt(String(body.limit)) || 5;
      const result = await autoPostToTelegram(limit);

      return NextResponse.json({
        success: result.posted > 0,
        message: result.posted > 0
          ? `Auto-posted ${result.posted} courses`
          : 'No unposted courses found or auto-post failed',
        posted: result.posted,
        errors: result.errors,
      });
    }

    // --- Post all new (unposted) courses ---
    if (action === 'post_new') {
      const unposted = await getUnpostedCourses(50);
      if (unposted.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No new courses to post',
          posted: 0,
          total: 0,
        });
      }

      const settings = await getTelegramSettings();
      const token = process.env.TELEGRAM_BOT_TOKEN || settings.bot_token;
      if (!token) {
        return NextResponse.json(
          { success: false, error: 'Bot token not configured. Set TELEGRAM_BOT_TOKEN env variable.' },
          { status: 400 }
        );
      }

      const { markCourseTelegramPosted, logTelegramMessage } = await import('@/lib/mongodb');
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
          errors.push(`Failed: ${course.title}`);
        }
      }

      return NextResponse.json({
        success: posted > 0,
        message: `Posted ${posted}/${unposted.length} courses`,
        posted,
        total: unposted.length,
        errors,
      });
    }

    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (e) {
    console.error('Telegram POST error:', e);
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
