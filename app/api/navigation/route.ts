import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient();
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    // Get navigation content from the content table
    const { data: navigationData, error } = await supabase
      .from('content')
      .select('body')
      .eq('company_id', tenantId)
      .eq('type', 'navigation')
      .eq('slug', 'main-navigation')
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error fetching navigation:', error);
      return NextResponse.json({ error: 'Failed to fetch navigation' }, { status: 500 });
    }

    // Return default navigation if none exists
    const navigation = navigationData?.body ? JSON.parse(navigationData.body) : {
      items: [
        { id: '1', label: 'الرئيسية', href: '/', enabled: true },
        { id: '2', label: 'الغرف', href: '/rooms', enabled: true },
        { id: '3', label: 'الحجوزات', href: '/bookings', enabled: true },
        { id: '4', label: 'اتصل بنا', href: '/contact', enabled: true }
      ]
    };

    return NextResponse.json(navigation);
  } catch (error) {
    console.error('Navigation GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new Error('Supabase not initialized');
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const navigation = await request.json();

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    // Validate navigation structure
    if (!navigation || !Array.isArray(navigation.items)) {
      return NextResponse.json({ error: 'Invalid navigation data' }, { status: 400 });
    }

    // Upsert navigation content
    const { error } = await supabase
      .from('content')
      .upsert({
        company_id: tenantId,
        type: 'navigation',
        slug: 'main-navigation',
        title: 'Main Navigation',
        body: JSON.stringify(navigation),
        status: 'published',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'company_id,type,slug'
      });

    if (error) {
      console.error('Error saving navigation:', error);
      return NextResponse.json({ error: 'Failed to save navigation' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Navigation PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}