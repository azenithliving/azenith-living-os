/**
 * Owner Control - Approval Decision API
 * POST /api/admin/owner/approval/decision
 * Approve or reject pending approval requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/dal/unified-supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      approval_id,
      company_id,
      decision, // 'approved' | 'rejected'
      decided_by,
      notes
    } = body;

    // Validation
    if (!approval_id || !company_id || !decision || !decided_by) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: approval_id, company_id, decision, decided_by' },
        { status: 400 }
      );
    }

    if (!['approved', 'rejected'].includes(decision)) {
      return NextResponse.json(
        { success: false, error: 'Decision must be "approved" or "rejected"' },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();

    // Get the approval request first
    const { data: approvalRequest, error: fetchError } = await supabaseServer
      .from('approval_requests')
      .select('*')
      .eq('id', approval_id)
      .eq('company_id', company_id)
      .single();

    if (fetchError || !approvalRequest) {
      return NextResponse.json(
        { success: false, error: 'Approval request not found' },
        { status: 404 }
      );
    }

    if (approvalRequest.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Request already ${approvalRequest.status}` },
        { status: 400 }
      );
    }

    // Update approval request
    const { data, error } = await supabaseServer
      .from('approval_requests')
      .update({
        status: decision,
        decided_by,
        decided_at: timestamp,
        notes: notes || null,
        updated_at: timestamp
      })
      .eq('id', approval_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating approval:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Create approval event
    await supabaseServer.from('agent_events').insert({
      company_id,
      event_type: decision === 'approved' ? 'approval_granted' : 'approval_rejected',
      severity: 'info',
      message: `Approval request #${approval_id.slice(0, 8)} ${decision}`,
      metadata: {
        approval_id,
        decision,
        decided_by,
        request_type: approvalRequest.request_type,
        amount: approvalRequest.amount
      }
    });

    // Trigger downstream actions based on approval type
    if (decision === 'approved') {
      await handleApprovalActions(approvalRequest, company_id);
    }

    return NextResponse.json({
      success: true,
      message: `Request ${decision} successfully`,
      data
    });
  } catch (error) {
    console.error('Approval decision error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle downstream actions when request is approved
async function handleApprovalActions(approvalRequest: any, companyId: string) {
  const context = approvalRequest.context || {};

  switch (approvalRequest.request_type) {
    case 'order':
      // Update order status
      if (context.order_id) {
        await supabaseServer
          .from('sales_orders')
          .update({
            status: 'contracted',
            updated_at: new Date().toISOString()
          })
          .eq('id', context.order_id);
      }
      break;

    case 'purchase':
      // Create purchase order
      if (context.purchase_order_id) {
        await supabaseServer
          .from('purchase_orders')
          .update({
            status: 'confirmed',
            updated_at: new Date().toISOString()
          })
          .eq('id', context.purchase_order_id);
      }
      break;

    case 'design_change':
      // Approve design version
      if (context.design_version_id) {
        await supabaseServer
          .from('design_versions')
          .update({
            status: 'approved',
            approved_at: new Date().toISOString()
          })
          .eq('id', context.design_version_id);
      }
      break;

    case 'price_change':
      // Update order pricing
      if (context.order_id && context.new_amount) {
        await supabaseServer
          .from('sales_orders')
          .update({
            total_amount: context.new_amount,
            updated_at: new Date().toISOString()
          })
          .eq('id', context.order_id);
      }
      break;
  }
}
