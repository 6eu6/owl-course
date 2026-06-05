import { NextResponse } from 'next/server';
import { getAdSettings, saveAdSettings, verifyAdminPassword } from '@/lib/mongodb';

// GET /api/ads - Returns public ad settings (for frontend rendering)
// Only returns safe fields; never exposes custom scripts in GET for security
export async function GET() {
  try {
    const settings = await getAdSettings();

    return NextResponse.json({
      success: true,
      settings: {
        google_adsense_client_id: settings.google_adsense_client_id || '',
        google_adsense_slot_id: settings.google_adsense_slot_id || '',
        header_ad_enabled: settings.header_ad_enabled === 'true',
        sidebar_ad_enabled: settings.sidebar_ad_enabled === 'true',
        between_courses_ad_enabled: settings.between_courses_ad_enabled === 'true',
        ad_banner_url: settings.ad_banner_url || '',
        ad_banner_link: settings.ad_banner_link || '',
      },
    });
  } catch (e) {
    console.error('Ads GET error:', e);
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}

// POST /api/ads - Save ad settings (admin protected)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { password } = body;

    // Verify admin password
    const isValid = await verifyAdminPassword(password);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid admin password' },
        { status: 401 }
      );
    }

    // Build settings object from allowed fields
    const settings: Record<string, string> = {
      google_adsense_client_id: String(body.google_adsense_client_id || ''),
      google_adsense_slot_id: String(body.google_adsense_slot_id || ''),
      header_ad_enabled: String(body.header_ad_enabled === true),
      sidebar_ad_enabled: String(body.sidebar_ad_enabled === true),
      between_courses_ad_enabled: String(body.between_courses_ad_enabled === true),
      custom_ad_script_head: String(body.custom_ad_script_head || ''),
      custom_ad_script_body: String(body.custom_ad_script_body || ''),
      ad_banner_url: String(body.ad_banner_url || ''),
      ad_banner_link: String(body.ad_banner_link || ''),
    };

    await saveAdSettings(settings);

    return NextResponse.json({
      success: true,
      message: 'Ad settings saved successfully',
    });
  } catch (e) {
    console.error('Ads POST error:', e);
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
