import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/dal/unified-supabase';
import { resolveAdminCompanyId } from '@/lib/admin-company';
import { buildApprovalRow } from '@/lib/qayyim/approval-intake';

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
    const body = await request.json().catch(() => null);
    const resolvedCompanyId = await resolveAdminCompanyId((body as { company_id?: string } | null)?.company_id);

    // The table's contract — a uuid action_id, a CHECK'd risk level, a
    // description that says something — is applied here instead of being
    // discovered as a Postgres error by whoever opened the decision card.
    const intake = buildApprovalRow(body, resolvedCompanyId || null);
    if (!intake.ok) {
      return NextResponse.json({ success: false, error: intake.error }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from('approval_requests')
      .insert(intake.row)
      .select('id')
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
