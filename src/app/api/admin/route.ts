import { NextResponse } from 'next/server';
import { setSetting } from '@/lib/mongodb';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key) {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 });
    }

    await setSetting(key, value);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
