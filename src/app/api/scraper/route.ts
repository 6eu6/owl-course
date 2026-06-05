import { NextResponse } from 'next/server';
import { runFullScrape } from '@/lib/scraper';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const source = body.source || 'all';

    let result;

    if (source === 'udemyfreebies') {
      const { scrapeUdemyFreebies } = await import('@/lib/scraper');
      result = { udemyfreebies: await scrapeUdemyFreebies(5), studybullet: { added: 0, processed: 0, errors: [] } };
    } else if (source === 'studybullet') {
      const { scrapeStudyBullet } = await import('@/lib/scraper');
      result = { udemyfreebies: { added: 0, processed: 0, errors: [] }, studybullet: await scrapeStudyBullet(3) };
    } else {
      result = await runFullScrape();
    }

    const totalAdded = (result.udemyfreebies?.added || 0) + (result.studybullet?.added || 0);

    return NextResponse.json({
      success: true,
      message: totalAdded > 0 ? `تم إضافة ${totalAdded} كورس جديد` : 'لا توجد كورسات جديدة',
      total_added: totalAdded,
      details: result,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { getCollection } = await import('@/lib/mongodb');
    const { COLLECTIONS } = await import('@/lib/types');
    const col = await getCollection(COLLECTIONS.SCRAPER_LOGS);
    const logs = await col.find({}).sort({ timestamp: -1 }).limit(10).toArray();
    return NextResponse.json({ logs });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
