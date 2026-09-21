/**
 * Owner Control - Emergency Stop API
 * POST /api/admin/owner/emergency-stop
 * GET /api/admin/owner/emergency-stop
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/dal/unified-supabase';
import { resolveAdminCompanyId } from '@/lib/admin-company';
import { requireAdminApi } from '@/lib/admin-api-guard';

// GET - Check emergency stop status
export async function GET(request: NextRequest) {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const { searchParams } = new URL(request.url);
    const companyId = await resolveAdminCompanyId(searchParams.get('company_id'));

    if (!companyId) {
      return NextResponse.json({
        success: true,
        data: {
          is_active: false,
          triggered_by: null,
          triggered_at: null,
          reason: null,
        },
        warnings: ['No company record is available for emergency stop state.'],
      });
    }

    const { data, error } = await supabaseServer
      .from('emergency_stop_state')
      .select('*')
      .eq('company_id', companyId)
      .order('triggered_at', { ascending: false })
      .limit(1)
      .single();

    if (error && (error.code === 'PGRST205' || error.code === 'PGRST116')) {
      return NextResponse.json({
        success: true,
        data: {
          is_active: false,
          triggered_by: null,
          triggered_at: null,
          reason: null,
        },
        warnings: error.code === 'PGRST205'
          ? ['emergency_stop_state table is not available.']
          : undefined,
      });
    }

    if (error) {
      console.error('Error fetching emergency stop state:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Return default inactive state if no record found
    return NextResponse.json({
      success: true,
      data: data || {
        is_active: false,
        triggered_by: null,
        triggered_at: null,
        reason: null
      }
    });
  } catch (error) {
    console.error('Emergency stop GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Trigger or release emergency stop
export async function POST(request: NextRequest) {
  try {
    const { user, unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, reason } = body;
    const companyId = await resolveAdminCompanyId(body.company_id);

    if (!companyId || !action) {
      return NextResponse.json(
        { success: false, error: 'A configured company and action are required' },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();

    if (action === 'trigger') {
      // Cancel all running tasks
      const { error: cancelError } = await supabaseServer
        .from('agent_tasks')
        .update({
          status: 'cancelled',
          updated_at: timestamp,
          error_message: 'Cancelled by emergency stop'
        })
        .eq('company_id', companyId)
        .in('status', ['running', 'queued', 'pending']);

      if (cancelError) {
        console.error('Error cancelling tasks:', cancelError);
      }

      // Release all device locks
      const { error: unlockError } = await supabaseServer
        .from('device_locks')
        .update({
          released_at: timestamp
        })
        .is('released_at', null)
        .eq('company_id', companyId);

      if (unlockError) {
        console.error('Error releasing locks:', unlockError);
      }

      // Create emergency stop record
      const { data, error } = await supabaseServer
        .from('emergency_stop_state')
        .insert({
          company_id: companyId,
          is_active: true,
          triggered_by: user.id,
          triggered_at: timestamp,
          reason: reason || 'Manual emergency stop'
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating emergency stop:', error);
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }

      // Create alert event
      await supabaseServer.from('agent_events').insert({
        company_id: companyId,
        event_type: 'emergency_stop',
        severity: 'critical',
        message: `Emergency stop triggered: ${reason}`,
        metadata: { triggered_by: user.id, timestamp }
      });

      return NextResponse.json({
        success: true,
        message: 'Emergency stop activated. All agents stopped.',
        data
      });

    } else if (action === 'release') {
      // Update latest emergency stop record
      const { data, error } = await supabaseServer
        .from('emergency_stop_state')
        .update({
          is_active: false,
          released_by: user.id,
          released_at: timestamp
        })
        .eq('company_id', companyId)
        .eq('is_active', true)
        .select()
        .single();

      if (error) {
        console.error('Error releasing emergency stop:', error);
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }

      // Create release event
      await supabaseServer.from('agent_events').insert({
        company_id: companyId,
        event_type: 'system_alert',
        severity: 'info',
        message: 'Emergency stop released. Agents can resume.',
        metadata: { released_by: user.id, timestamp }
      });

      return NextResponse.json({
        success: true,
        message: 'Emergency stop released. System resumed.',
        data
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use "trigger" or "release"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Emergency stop POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
