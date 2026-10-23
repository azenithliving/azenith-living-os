/**
 * Owner Dashboard API
 * GET /api/admin/owner/dashboard
 * Returns comprehensive dashboard data for the owner
 *
 * Measured on the live record 2026-10-23: the alert block read `agent_events` filtering on
 * `severity` and `acknowledged` — two columns that table does not have — so the query failed
 * on every load, the failure was caught and returned as an empty list, and his screen printed
 * «جميع الأنظمة مستقرة» over a number that was never measured. The alerts now come from the
 * store's ledger through the one reading rule, asking for today's span; a ledger that does not
 * answer is reported as a failure in its own section instead of becoming a calm zero. The
 * "delayed" card counts papers that have actually waited a day, and the connected-devices
 * figure stopped being a hard-coded null.
 */

import { NextRequest, NextResponse } from 'next/server';
import { LEADER_KEYS } from '@/lib/ops/identity';
import { supabaseServer } from '@/lib/dal/unified-supabase';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { resolveAdminCompanyId } from '@/lib/admin-company';
import { requireAdminApi } from '@/lib/admin-api-guard';
import { readOpenAlerts } from '@/lib/ops/alerts';
import { withOwnerPapers } from '@/lib/ops/approval-intake';

export async function GET(request: NextRequest) {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const { searchParams } = new URL(request.url);
    const companyId = await resolveAdminCompanyId(searchParams.get('company_id'));

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'شركة المتجر مش مسجّلة في الإعدادات — اللوحة ما قريتش' },
        { status: 404 }
      );
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    // Run all dashboard queries in parallel
    const [
      ordersResult,
      productionResult,
      approvalsResult,
      inventoryResult,
      agentsResult,
      revenueResult,
      alertsResult,
      overduePapers,
      connectedDevices
    ] = await Promise.all([
      // Orders summary
      getOrdersSummary(companyId, startOfMonth),
      // Production status
      getProductionStatus(companyId),
      // Pending approvals
      getPendingApprovals(companyId),
      // Low stock items
      getLowStockItems(companyId),
      // Agent stats
      getAgentStats(companyId, startOfMonth, startOfToday),
      // Revenue this month
      getRevenueStats(companyId, startOfMonth),
      // System alerts — the store's ledger, read through the one rule
      getOpenAlerts(companyId, startOfToday),
      // Papers that have actually waited a day for his word
      countOverduePapers(companyId),
      // Devices the store sees connected right now
      countConnectedDevices(),
    ]);

    const dashboard = {
      // Today's snapshot
      today: {
        date: now.toISOString().split('T')[0],
        orders_pending: ordersResult.pending,
        orders_in_production: productionResult.inProduction,
        orders_ready: productionResult.ready,
        pending_approvals: approvalsResult.count,
        overdue_papers: overduePapers,
        payments_due: revenueResult.paymentsDue,
        low_stock_alerts: inventoryResult.lowStockCount
      },

      // Monthly summary
      this_month: {
        total_orders: ordersResult.total,
        completed_orders: ordersResult.completed,
        total_revenue: revenueResult.total,
        estimated_profit: revenueResult.profit,
        avg_order_value: revenueResult.avgOrderValue,
        on_time_delivery_rate: productionResult.onTimeRate
      },

      // Pending decisions
      pending_decisions: approvalsResult.items,

      // Low stock alerts
      inventory_alerts: inventoryResult.items,

      // Agent performance
      agent_performance: { ...agentsResult, active_devices: connectedDevices },

      // Production pipeline
      production_pipeline: productionResult.pipeline,

      // System alerts — and the reason, when the ledger did not answer
      alerts: alertsResult.alerts,
      alerts_error: alertsResult.error
    };

    return NextResponse.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { success: false, error: 'اللوحة ما قريتش — سبب الخطأ اتسجّل في اللوج' },
      { status: 500 }
    );
  }
}

// Get orders summary
async function getOrdersSummary(companyId: string, startOfMonth: string) {
  const { data, error } = await supabaseServer
    .from('sales_orders')
    .select('status', { count: 'exact' })
    .eq('company_id', companyId)
    .gte('created_at', startOfMonth);

  if (error) {
    console.error('Orders summary error:', error);
    return { total: 0, completed: 0, pending: 0 };
  }

  const total = data?.length || 0;
  const completed = data?.filter(o => o.status === 'completed').length || 0;
  const pending = data?.filter(o => ['new', 'draft', 'pending'].includes(o.status)).length || 0;

  return { total, completed, pending };
}

// Get production status
async function getProductionStatus(companyId: string) {
  const { data, error } = await supabaseServer
    .from('production_jobs')
    .select('status, production_stages(name, color_code)')
    .eq('company_id', companyId);

  if (error) {
    console.error('Production status error:', error);
    return { inProduction: 0, ready: 0, pipeline: [], onTimeRate: null };
  }

  const inProduction = data?.filter(j => j.status === 'in_progress').length || 0;
  const ready = data?.filter(j => j.status === 'completed').length || 0;

  // Build pipeline by stage
  const pipelineMap = new Map();
  data?.forEach(job => {
    const stageName = (job.production_stages as any)?.name || 'Unknown';
    const color = (job.production_stages as any)?.color_code || '#3B82F6';
    if (!pipelineMap.has(stageName)) {
      pipelineMap.set(stageName, { stage_name: stageName, color, job_count: 0 });
    }
    pipelineMap.get(stageName).job_count++;
  });

  return {
    inProduction,
    ready,
    pipeline: Array.from(pipelineMap.values()),
    // Delivery dates are not available on every installation, so do not invent a rate.
    onTimeRate: null,
  };
}

// Get pending approvals
async function getPendingApprovals(companyId: string) {
  const { data, error } = await withOwnerPapers(
    supabaseServer
      .from('approval_requests')
      .select('*, users(name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10),
    companyId,
  );

  if (error) {
    console.error('Pending approvals error:', error);
    return { count: 0, items: [] };
  }

  const items = data?.map(item => ({
    id: item.id,
    type: item.action_type,
    title: item.description,
    description: item.description,
    risk_level: item.risk_level,
    requested_by: (item.users as any)?.name || '',
    created_at: item.created_at,
    context: item.metadata
  })) || [];

  return { count: items.length, items };
}

// Get low stock items
async function getLowStockItems(companyId: string) {
  const { data, error } = await supabaseServer
    .from('inventory_items')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('current_quantity', { ascending: true })
    .limit(200);

  if (error) {
    console.error('Low stock error:', error);
    return { lowStockCount: 0, items: [] };
  }

  const items = data
    ?.filter((item) => Number(item.current_quantity) <= Number(item.min_stock_level))
    .slice(0, 10)
    .map(item => ({
    id: item.id,
    name: item.name,
    sku: item.sku,
    current_quantity: item.current_quantity,
    min_stock_level: item.min_stock_level,
    unit: item.unit_of_measure
  })) || [];

  return { lowStockCount: items.length, items };
}

// Get agent stats
async function getAgentStats(companyId: string, startOfMonth: string, startOfToday: string) {
  // One read for every stamp the leader has been stored under: a company whose rows
  // predate the renames still has its real work, and filtering on the live key alone
  // would show its owner a zero.
  const { data: leaderProfiles } = await supabaseServer
    .from('agent_profiles')
    .select('id, agent_key')
    .eq('company_id', companyId)
    .in('agent_key', LEADER_KEYS);

  const leaderProfile =
    leaderProfiles?.find((p: any) => p.agent_key === 'ops-lead') ?? leaderProfiles?.[0] ?? null;

  const { data: vanguardProfile } = await supabaseServer
    .from('agent_profiles')
    .select('id')
    .eq('company_id', companyId)
    .eq('agent_key', 'vanguard')
    .maybeSingle();

  // Get tasks stats
  const { data: tasksData } = await supabaseServer
    .from('agent_tasks')
    .select('agent_profile_id, status, created_at')
    .eq('company_id', companyId)
    .gte('created_at', startOfMonth);

  const leaderTasks = tasksData?.filter(t => t.agent_profile_id === leaderProfile?.id) || [];
  const vanguardTasks = tasksData?.filter(t => t.agent_profile_id === vanguardProfile?.id) || [];
  const leaderTasksToday = leaderTasks.filter((t: any) => t.created_at >= startOfToday).length;
  const vanguardTasksToday = vanguardTasks.filter((t: any) => t.created_at >= startOfToday).length;

  return {
    leader: {
      tasks_today: leaderTasksToday,
      tasks_this_month: leaderTasks.length,
      completed_tasks: leaderTasks.filter(t => t.status === 'completed').length,
    },
    vanguard: {
      tasks_today: vanguardTasksToday,
      tasks_this_month: vanguardTasks.length,
      completed_tasks: vanguardTasks.filter(t => t.status === 'completed').length,
      deals_closed: vanguardTasks.filter(t => t.status === 'completed').length
    },
  };
}

// Get revenue stats
async function getRevenueStats(companyId: string, startOfMonth: string) {
  const { data, error } = await supabaseServer
    .from('sales_orders')
    .select('total_amount, deposit_amount, deposit_paid')
    .eq('company_id', companyId)
    .gte('created_at', startOfMonth)
    .not('total_amount', 'is', null);

  if (error) {
    console.error('Revenue stats error:', error);
    return { total: 0, profit: null, avgOrderValue: 0, paymentsDue: 0 };
  }

  const total = data?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
  const avgOrderValue = data?.length ? total / data.length : 0;
  // Cost data is not stored with every order, so profit must remain unavailable
  // rather than being presented as a fabricated percentage.
  const profit = null;

  // Calculate pending payments
  const unpaid = data?.filter(o => !o.deposit_paid).length || 0;

  return { total, profit, avgOrderValue, paymentsDue: unpaid };
}

// Get system alerts — through the store's one reading rule, over today
async function getOpenAlerts(companyId: string, startOfToday: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { alerts: [], error: 'الدفتر غير متصل دلوقتي — التنبيهات ما قريتش' };

  const read = await readOpenAlerts(supabase, companyId, { limit: 100, sinceIso: startOfToday });
  if (!read.ok) return { alerts: [], error: read.error };

  return { alerts: read.alerts, error: null };
}

// Papers that have waited a day for his word
async function countOverduePapers(companyId: string) {
  const { data, error } = await withOwnerPapers(
    supabaseServer
      .from('approval_requests')
      .select('id')
      .eq('status', 'pending')
      .lt('requested_at', new Date(Date.now() - 86_400_000).toISOString()),
    companyId,
  );

  if (error) {
    console.error('Overdue papers error:', error);
    return null;
  }
  return (data ?? []).length;
}

// Devices the store sees connected right now
async function countConnectedDevices() {
  const { count, error } = await supabaseServer
    .from('agent_devices')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  if (error) {
    console.error('Connected devices error:', error);
    return null;
  }
  return count ?? 0;
}
