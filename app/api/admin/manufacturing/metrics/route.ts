import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/dal/unified-supabase';
import { resolveAdminCompanyId } from '@/lib/admin-company';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = await resolveAdminCompanyId(searchParams.get('company_id'));

  try {
    if (!companyId) {
      return NextResponse.json({
        success: true,
        data: {
          orders_in_production: 0,
          orders_ready: 0,
          pending_payments: 0,
          low_stock_items: 0,
          delayed_jobs: 0,
          jobs_completed_today: 0,
        },
        warnings: ['No company record is available for manufacturing metrics.'],
      });
    }

    const [jobsResult, inventoryResult, ordersResult] = await Promise.all([
      supabaseServer
        .from('production_jobs')
        .select('status')
        .eq('company_id', companyId),
      supabaseServer
        .from('inventory_items')
        .select('current_quantity, min_stock_level')
        .eq('company_id', companyId)
        .eq('is_active', true),
      supabaseServer
        .from('sales_orders')
        .select('deposit_paid')
        .eq('company_id', companyId),
    ]);

    const jobs = jobsResult.data || [];
    const inventoryItems = inventoryResult.data || [];
    const orders = ordersResult.data || [];

    return NextResponse.json({
      success: true,
      data: {
        orders_in_production: jobs.filter((job) => job.status === 'in_progress').length,
        orders_ready: jobs.filter((job) => job.status === 'completed' || job.status === 'ready').length,
        pending_payments: orders.filter((order) => !order.deposit_paid).length,
        low_stock_items: inventoryItems.filter(
          (item) => Number(item.current_quantity || 0) <= Number(item.min_stock_level || 0)
        ).length,
        delayed_jobs: 0,
        jobs_completed_today: 0,
      },
      warnings: [jobsResult.error, inventoryResult.error, ordersResult.error]
        .filter(Boolean)
        .map((error) => error?.message),
    });
  } catch (error) {
    console.error('Manufacturing metrics error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load manufacturing metrics' },
      { status: 500 }
    );
  }
}
