/**
 * Owner Dashboard API
 * GET /api/admin/owner/dashboard
 * Returns comprehensive dashboard data for the owner
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/dal/unified-supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'company_id required' },
        { status: 400 }
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
      alertsResult
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
      getAgentStats(companyId, startOfMonth),
      // Revenue this month
      getRevenueStats(companyId, startOfMonth),
      // System alerts
      getSystemAlerts(companyId, startOfToday)
    ]);

    const dashboard = {
      // Today's snapshot
      today: {
        date: now.toISOString().split('T')[0],
        orders_in_production: productionResult.inProduction,
        orders_ready: productionResult.ready,
        pending_approvals: approvalsResult.count,
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
      agent_performance: agentsResult,

      // Production pipeline
      production_pipeline: productionResult.pipeline,

      // System alerts
      alerts: alertsResult,

      // Quick stats
      quick_stats: {
        prime_tasks_today: agentsResult.prime?.tasks_today || 0,
        vanguard_tasks_today: agentsResult.vanguard?.tasks_today || 0,
        active_devices: agentsResult.active_devices || 0,
        stuck_tasks: alertsResult.filter((a: any) => a.event_type === 'task_stuck').length
      }
    };

    return NextResponse.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
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
    return { total: 0, completed: 0 };
  }

  const total = data?.length || 0;
  const completed = data?.filter(o => o.status === 'completed').length || 0;

  return { total, completed };
}

// Get production status
async function getProductionStatus(companyId: string) {
  const { data, error } = await supabaseServer
    .from('production_jobs')
    .select('status, production_stages(name, color_code)')
    .eq('company_id', companyId);

  if (error) {
    console.error('Production status error:', error);
    return { inProduction: 0, ready: 0, pipeline: [], onTimeRate: 0 };
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
    onTimeRate: 85 // Placeholder - would calculate from actual vs scheduled dates
  };
}

// Get pending approvals
async function getPendingApprovals(companyId: string) {
  const { data, error } = await supabaseServer
    .from('approval_requests')
    .select('*, users(name)')
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Pending approvals error:', error);
    return { count: 0, items: [] };
  }

  const items = data?.map(item => ({
    id: item.id,
    type: item.request_type,
    title: item.title,
    description: item.description,
    amount: item.amount,
    requested_by: (item.users as any)?.name || 'Unknown',
    created_at: item.created_at,
    context: item.context
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
    .lte('current_quantity', 'min_stock_level')
    .order('current_quantity', { ascending: true })
    .limit(10);

  if (error) {
    console.error('Low stock error:', error);
    return { lowStockCount: 0, items: [] };
  }

  const items = data?.map(item => ({
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
async function getAgentStats(companyId: string, startOfMonth: string) {
  // Get PRIME stats
  const { data: primeProfile } = await supabaseServer
    .from('agent_profiles')
    .select('id')
    .eq('company_id', companyId)
    .eq('agent_key', 'prime')
    .single();

  const { data: vanguardProfile } = await supabaseServer
    .from('agent_profiles')
    .select('id')
    .eq('company_id', companyId)
    .eq('agent_key', 'vanguard')
    .single();

  // Get tasks stats
  const { data: tasksData } = await supabaseServer
    .from('agent_tasks')
    .select('agent_profile_id, status')
    .eq('company_id', companyId)
    .gte('created_at', startOfMonth);

  // Get active devices
  const { count: activeDevices } = await supabaseServer
    .from('agent_devices')
    .select('*', { count: 'exact' })
    .eq('company_id', companyId)
    .eq('status', 'online');

  const primeTasks = tasksData?.filter(t => t.agent_profile_id === primeProfile?.id) || [];
  const vanguardTasks = tasksData?.filter(t => t.agent_profile_id === vanguardProfile?.id) || [];
  const primeTasksToday = primeTasks.filter((t: any) => t.created_at >= startOfMonth).length;
  const vanguardTasksToday = vanguardTasks.filter((t: any) => t.created_at >= startOfMonth).length;

  return {
    prime: {
      tasks_today: primeTasksToday,
      tasks_this_month: primeTasks.length,
      completed_tasks: primeTasks.filter(t => t.status === 'completed').length,
      rating: 5 // Placeholder
    },
    vanguard: {
      tasks_today: vanguardTasksToday,
      tasks_this_month: vanguardTasks.length,
      completed_tasks: vanguardTasks.filter(t => t.status === 'completed').length,
      deals_closed: vanguardTasks.filter(t => t.status === 'completed').length
    },
    active_devices: activeDevices || 0
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
    return { total: 0, profit: 0, avgOrderValue: 0, paymentsDue: 0 };
  }

  const total = data?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
  const avgOrderValue = data?.length ? total / data.length : 0;
  const profit = total * 0.25; // Assume 25% margin

  // Calculate pending payments
  const unpaid = data?.filter(o => !o.deposit_paid).length || 0;

  return { total, profit, avgOrderValue, paymentsDue: unpaid };
}

// Get system alerts
async function getSystemAlerts(companyId: string, startOfToday: string) {
  const { data, error } = await supabaseServer
    .from('agent_events')
    .select('*')
    .eq('company_id', companyId)
    .gte('created_at', startOfToday)
    .in('severity', ['warning', 'critical'])
    .eq('acknowledged', false)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('System alerts error:', error);
    return [];
  }

  return data || [];
}
