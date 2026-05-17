import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/dal/unified-supabase';
import { resolveAdminCompanyId } from '@/lib/admin-company';

export const dynamic = 'force-dynamic';

const progressByStatus: Record<string, number> = {
  draft: 5,
  quoted: 15,
  contracted: 30,
  pending: 35,
  scheduled: 45,
  in_production: 65,
  ready: 90,
  completed: 100,
  delivered: 100,
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = await resolveAdminCompanyId(searchParams.get('company_id'));
  const status = searchParams.get('status');

  try {
    if (!companyId) {
      return NextResponse.json({
        success: true,
        data: [],
        warnings: ['No company record is available for manufacturing orders.'],
      });
    }

    let query = supabaseServer
      .from('sales_orders')
      .select('id, status, total_amount, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Manufacturing orders error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const orders = (data || []).map((order) => {
      const orderStatus = order.status || 'draft';
      return {
        id: order.id,
        customer_name: 'Unknown',
        status: orderStatus,
        total_amount: order.total_amount || 0,
        current_stage: orderStatus,
        progress_percent: progressByStatus[orderStatus] ?? 0,
        expected_delivery: null,
        items_count: 0,
      };
    });

    return NextResponse.json({ success: true, data: orders });
  } catch (error) {
    console.error('Manufacturing orders route error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load manufacturing orders' },
      { status: 500 }
    );
  }
}
