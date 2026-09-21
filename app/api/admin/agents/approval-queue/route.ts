import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/dal/unified-supabase';
import { resolveAdminCompanyId } from '@/lib/admin-company';

// GET: جلب كل الطلبات المعلقة
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = await resolveAdminCompanyId(searchParams.get('company_id'));

    let query = supabaseServer
      .from('approval_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (companyId) {
      query = query.or(`company_id.eq.${companyId},company_id.is.null`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      approvals: data || []
    });
  } catch (error: any) {
    console.error('Error fetching approvals:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch approvals' },
      { status: 500 }
    );
  }
}

// POST: إضافة طلب جديد للموافقة
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const resolvedCompanyId = await resolveAdminCompanyId(body.company_id);
    
    const insertPayload: Record<string, unknown> = {
      action_id: body.action_id,
      action_type: body.action_type,
      description: body.description,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    if (resolvedCompanyId) {
      insertPayload.company_id = resolvedCompanyId;
    }

    const { data, error } = await supabaseServer
      .from('approval_requests')
      .insert(insertPayload)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      id: data.id,
      message: 'Approval request created'
    });
  } catch (error: any) {
    console.error('Error creating approval:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create approval' },
      { status: 500 }
    );
  }
}
