import { NextResponse } from 'next/server';

// POST /api/telegram - Send course to Telegram (placeholder)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { courseId, action } = body;

    // Placeholder for future Telegram integration
    return NextResponse.json({
      success: true,
      message: 'Telegram integration is not yet configured. Please set up bot token and channels in admin settings.',
      status: 'placeholder',
    });
  } catch (e) {
    console.error('Telegram API error:', e);
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}

// GET /api/telegram - Get Telegram status
export async function GET() {
  return NextResponse.json({
    success: true,
    status: 'placeholder',
    message: 'Telegram integration is not yet configured.',
    configured: false,
  });
}
