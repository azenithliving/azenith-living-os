/**
 * Manufacturing API - Production Schedule
 * GET /api/admin/manufacturing/schedule
 * POST /api/admin/manufacturing/schedule
 * Manage production schedule and Gantt chart data
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/dal/unified-supabase';

// GET - Fetch production schedule
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const view = searchParams.get('view') || 'week'; // day, week, month

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'company_id required' },
        { status: 400 }
      );
    }

    // Calculate date range if not provided
    const now = new Date();
    const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Fetch production jobs with stages
    const { data: jobs, error } = await supabaseServer
      .from('production_jobs')
      .select(`
        *,
        production_stages(name, color_code, default_duration_hours),
        sales_orders(id, customer_id, users(name)),
        sales_order_items(description)
      `)
      .eq('company_id', companyId)
      .or(`scheduled_start.gte.${start.toISOString()},scheduled_end.lte.${end.toISOString()}`)
      .order('scheduled_start', { ascending: true });

    if (error) {
      console.error('Schedule fetch error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Format for Gantt chart
    const schedule = jobs?.map(job => ({
      id: job.id,
      name: (job.sales_order_items as any)?.description || `Job ${job.id.slice(0, 8)}`,
      customer: (job.sales_orders as any)?.users?.name || 'Unknown',
      stage: (job.production_stages as any)?.name || 'Unknown',
      stage_color: (job.production_stages as any)?.color_code || '#3B82F6',
      start: job.scheduled_start || job.created_at,
      end: job.scheduled_end || new Date(new Date(job.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString(),
      progress: calculateProgress(job),
      status: job.status,
      priority: job.priority,
      assigned_to: job.assigned_to,
      dependencies: [],
      order_id: job.sales_order_id
    })) || [];

    // Fetch production stages for timeline
    const { data: stages } = await supabaseServer
      .from('production_stages')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('sequence_order', { ascending: true });

    return NextResponse.json({
      success: true,
      data: {
        schedule,
        stages: stages || [],
        date_range: {
          start: start.toISOString(),
          end: end.toISOString(),
          view
        },
        summary: {
          total_jobs: schedule.length,
          in_progress: schedule.filter(s => s.status === 'in_progress').length,
          completed: schedule.filter(s => s.status === 'completed').length,
          delayed: schedule.filter(s => new Date(s.end) < now && s.status !== 'completed').length
        }
      }
    });
  } catch (error) {
    console.error('Schedule GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create or update schedule entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      company_id,
      production_job_id,
      stage_id,
      scheduled_start,
      scheduled_end,
      resource_id,
      notes,
      action = 'create' // create, update, reschedule
    } = body;

    if (!company_id || !production_job_id) {
      return NextResponse.json(
        { success: false, error: 'company_id and production_job_id required' },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();

    if (action === 'reschedule') {
      // Check for conflicts
      const { data: conflicts } = await supabaseServer
        .from('production_schedule_entries')
        .select('*')
        .eq('company_id', company_id)
        .eq('resource_id', resource_id)
        .neq('production_job_id', production_job_id)
        .or(`scheduled_start.lte.${scheduled_end},scheduled_end.gte.${scheduled_start}`);

      if (conflicts && conflicts.length > 0) {
        return NextResponse.json({
          success: false,
          error: 'Resource conflict detected',
          conflicts
        }, { status: 409 });
      }
    }

    // Update or create schedule entry
    const { data, error } = await supabaseServer
      .from('production_schedule_entries')
      .upsert({
        company_id,
        production_job_id,
        stage_id,
        scheduled_start,
        scheduled_end,
        resource_id,
        notes,
        updated_at: timestamp
      }, {
        onConflict: 'production_job_id,stage_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Schedule update error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Update production job dates
    await supabaseServer
      .from('production_jobs')
      .update({
        scheduled_start,
        scheduled_end,
        current_stage_id: stage_id,
        updated_at: timestamp
      })
      .eq('id', production_job_id);

    return NextResponse.json({
      success: true,
      message: `Schedule ${action === 'create' ? 'created' : 'updated'} successfully`,
      data
    });
  } catch (error) {
    console.error('Schedule POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Calculate progress percentage
function calculateProgress(job: any): number {
  if (job.status === 'completed') return 100;
  if (job.status === 'pending') return 0;
  if (job.status === 'in_progress') {
    // Estimate based on time elapsed
    if (job.actual_start && job.scheduled_end) {
      const start = new Date(job.actual_start).getTime();
      const end = new Date(job.scheduled_end).getTime();
      const now = Date.now();
      const total = end - start;
      const elapsed = now - start;
      return Math.min(95, Math.round((elapsed / total) * 100));
    }
    return 25; // Default for in-progress
  }
  return 0;
}
