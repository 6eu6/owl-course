import { NextResponse } from 'next/server';
import { autoPostToTelegram, testTelegramConnection } from '@/lib/telegram';
import { getTelegramSettings, saveTelegramSettings } from '@/lib/settings';
import { getCollection } from '@/lib/mongodb';
import { COLLECTIONS } from '@/lib/types';

export async function GET() {
  try {
    let settings;
    try {
      settings = await getTelegramSettings();
    } catch {
      settings = {
        bot_token: '',
        channels: [{ name: 'القناة الرئيسية', id: '', active: true }],
        auto_post: false,
        message_template: '{title}\n{link}',
      };
    }

    let stats = { total_courses: 0, posted_courses: 0, pending_courses: 0 };
    let messages = [];

    try {
      const coursesCol = await getCollection(COLLECTIONS.COURSES);
      const msgCol = await getCollection(COLLECTIONS.TELEGRAM_MESSAGES);

      const [totalCourses, postedCourses, msgs] = await Promise.all([
        coursesCol.countDocuments({ is_published: true }),
        coursesCol.countDocuments({ telegram_posted: true }),
        msgCol.find({}).sort({ sent_at: -1 }).limit(10).toArray(),
      ]);

      stats = { total_courses: totalCourses, posted_courses: postedCourses, pending_courses: totalCourses - postedCourses };
      messages = msgs.map((m: Record<string, unknown>) => ({
        id: String(m._id),
        course_title: m.course_title,
        channels: m.channels,
        status: m.status,
        sent_at: m.sent_at,
      }));
    } catch {
      // MongoDB not connected
    }

    return NextResponse.json({ settings, stats, recent_messages: messages });
  } catch (e) {
    return NextResponse.json({
      settings: { bot_token: '', channels: [{ name: 'القناة الرئيسية', id: '', active: true }], auto_post: false, message_template: '' },
      stats: { total_courses: 0, posted_courses: 0, pending_courses: 0 },
      recent_messages: [],
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action || 'save';

    if (action === 'save') {
      await saveTelegramSettings(body);
      return NextResponse.json({ success: true, message: 'تم حفظ الإعدادات بنجاح' });
    }

    if (action === 'test') {
      const { bot_token, channel_id } = body;
      const result = await testTelegramConnection(bot_token, channel_id);
      return NextResponse.json(result);
    }

    if (action === 'auto_post') {
      const result = await autoPostToTelegram(body.limit || 5);
      return NextResponse.json({ success: true, posted: result.posted, errors: result.errors });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
