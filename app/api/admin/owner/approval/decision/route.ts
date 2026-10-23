/**
 * Owner Control - Approval Decision API
 * POST /api/admin/owner/approval/decision
 * Approve or reject pending approval requests
 *
 * Measured on the live record 2026-10-23: this door wrote `decided_by`, `decided_at` and
 * `notes` into `approval_requests`, and none of those columns exist — the table's own answer
 * to a decision is `approved_by`, `approved_at` and `rejection_reason`. Every press therefore
 * failed with the database's English sentence, and the receipt went to `agent_events` under
 * columns that table does not have. Both now speak the shape the record actually holds.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/dal/unified-supabase';
import { resolveAdminCompanyId } from '@/lib/admin-company';
import { requireAdminApi } from '@/lib/admin-api-guard';
import { recordLedgerEvent } from '@/lib/ops/ledger';

export async function POST(request: NextRequest) {
  try {
    const { user, unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;
    if (!user) {
      return NextResponse.json({ success: false, error: 'لازم تكون داخل بلوحة التحكم' }, { status: 401 });
    }

    const body = await request.json();
    const {
      approval_id,
      decision, // 'approved' | 'rejected'
      notes
    } = body;
    const companyId = await resolveAdminCompanyId(body.company_id);

    // Validation
    if (!approval_id || !companyId || !decision) {
      return NextResponse.json(
        { success: false, error: 'القرار ما اتسجّلش: رقم الطلب والقرار مطلوبين' },
        { status: 400 },
      );
    }

    if (!['approved', 'rejected'].includes(decision)) {
      return NextResponse.json(
        { success: false, error: 'القرار لازم يكون «موافق» أو «مرفوض»' },
        { status: 400 },
      );
    }

    const timestamp = new Date().toISOString();

    // Get the approval request first
    const { data: approvalRequest, error: fetchError } = await supabaseServer
      .from('approval_requests')
      .select('*')
      .eq('id', approval_id)
      .eq('company_id', companyId)
      .single();

    if (fetchError || !approvalRequest) {
      return NextResponse.json(
        { success: false, error: 'مفيش طلب مستني بهذا الرقم' },
        { status: 404 },
      );
    }

    if (approvalRequest.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'الطلب ده اتفصل فيه قبل كده' },
        { status: 400 },
      );
    }

    // Update approval request — the columns the table actually answers to
    const { data, error } = await supabaseServer
      .from('approval_requests')
      .update({
        status: decision,
        approved_by: user.id,
        approved_at: timestamp,
        rejection_reason: decision === 'rejected' ? (notes || null) : undefined,
        updated_at: timestamp
      })
      .eq('id', approval_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating approval:', error);
      return NextResponse.json(
        { success: false, error: 'القرار ما اتسجّلش في السجل — سبب الخطأ اتسجّل في اللوج' },
        { status: 500 }
      );
    }

    // Record the owner's word in the store's ledger
    const record = await recordLedgerEvent({
      eventType: decision === 'approved' ? 'approval_granted' : 'approval_rejected',
      source: 'owner',
      payload: {
        approval_id,
        decision,
        action_type: approvalRequest.action_type ?? null,
        risk_level: approvalRequest.risk_level ?? null,
      },
      companyId,
    });

    // Trigger downstream actions based on approval type
    if (decision === 'approved') {
      await handleApprovalActions(approvalRequest, companyId);
    }

    return NextResponse.json({
      success: true,
      recorded: record.ok,
      message: record.ok
        ? decision === 'approved'
          ? 'كلمتك اتسجّلت: موافق'
          : 'كلمتك اتسجّلت: مرفوض'
        : 'القرار اتنفّذ، بس ما اتسجّلش في دفتر المتجر',
      data
    });
  } catch (error) {
    console.error('Approval decision error:', error);
    return NextResponse.json(
      { success: false, error: 'القرار وقف — سبب الخطأ اتسجّل في اللوج' },
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
