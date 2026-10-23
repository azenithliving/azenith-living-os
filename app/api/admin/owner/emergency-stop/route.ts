/**
 * Owner Control - Emergency Stop
 * GET/POST /api/admin/owner/emergency-stop
 *
 * What this control actually does, measured on the live record 2026-10-23: it cancels the
 * store's running and queued tasks. Two of its steps were aimed at tables that do not exist
 * at all (`emergency_stop_state` and `device_locks`), so pressing it answered 500 with the
 * database's own English sentence, and its receipt went to `agent_events` under columns that
 * table does not have — so the moment was never recorded either. Nothing in the store reads a
 * stop flag: the cancel is the whole effect, and it is reported as a number, not as a promise.
 *
 * The stop and its release are now recorded in the store's ledger, which both of the owner's
 * alert strips read through one rule.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/dal/unified-supabase';
import { resolveAdminCompanyId } from '@/lib/admin-company';
import { requireAdminApi } from '@/lib/admin-api-guard';
import { recordLedgerEvent } from '@/lib/ops/ledger';

export const dynamic = 'force-dynamic';

const STOP_TYPES = ['emergency_stop', 'emergency_stop_released'] as const;

async function newestStopEvent(companyId: string, type: (typeof STOP_TYPES)[number]) {
  const { data } = await supabaseServer
    .from('ops_sync_events')
    .select('payload,created_at')
    .eq('company_id', companyId)
    .eq('event_type', type)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

// GET - is the store stopped right now, and when was it last said out loud
export async function GET() {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const companyId = await resolveAdminCompanyId();
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'شركة المتجر مش مسجّلة في الإعدادات — حالة الإيقاف ما قريتش' },
        { status: 503 },
      );
    }

    const [stop, release] = await Promise.all([
      newestStopEvent(companyId, 'emergency_stop'),
      newestStopEvent(companyId, 'emergency_stop_released'),
    ]);

    const stopped = Boolean(stop && (!release || String(stop.created_at) > String(release.created_at)));

    return NextResponse.json({
      success: true,
      data: {
        stopped,
        at: (stopped ? stop : release)?.created_at ?? null,
        reason: stopped ? ((stop?.payload?.reason as string) ?? null) : null,
        cancelled: stopped ? Number(stop?.payload?.cancelled ?? 0) : 0,
      },
    });
  } catch (error) {
    console.error('[EmergencyStop] GET error:', error);
    return NextResponse.json({ success: false, error: 'حالة الإيقاف ما قريتش' }, { status: 500 });
  }
}

// POST - stop the workers, or let them go back to work
export async function POST(request: NextRequest) {
  try {
    const { user, unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;
    if (!user) {
      return NextResponse.json({ success: false, error: 'لازم تكون داخل بلوحة التحكم' }, { status: 401 });
    }

    const body = await request.json();
    const { action, reason } = body;
    const companyId = await resolveAdminCompanyId(body.company_id);

    if (!companyId || !action) {
      return NextResponse.json(
        { success: false, error: 'لازم تكون داخل لوحة التحكم عشان الإيقاف يتنفّذ' },
        { status: 400 },
      );
    }

    const timestamp = new Date().toISOString();

    if (action === 'trigger') {
      // The only effect this control has: whatever the store was working on gets cancelled.
      // The count comes from the rows the database gave back, not from a promise.
      const { data: cancelledRows, error: cancelError } = await supabaseServer
        .from('agent_tasks')
        .update({
          status: 'cancelled',
          updated_at: timestamp,
          error_message: 'Cancelled by emergency stop',
        })
        .eq('company_id', companyId)
        .in('status', ['running', 'queued', 'pending'])
        .select('id');

      if (cancelError) {
        console.error('[EmergencyStop] cancel failed:', cancelError);
        return NextResponse.json(
          { success: false, error: 'الموظفين ما وقفوش — الدفتر ما سجّلش حاجة' },
          { status: 500 },
        );
      }

      const cancelled = (cancelledRows ?? []).length;

      const record = await recordLedgerEvent({
        eventType: 'emergency_stop',
        source: 'owner',
        payload: { reason: typeof reason === 'string' && reason ? reason : 'من لوحة المالك', cancelled },
        companyId,
      });

      return NextResponse.json({
        success: true,
        recorded: record.ok,
        data: { stopped: true, cancelled, at: timestamp },
        message: record.ok
          ? 'الدار واقفة — والموظفين اللي كانوا شغالين اتلغوا'
          : 'الموظفين اتلغوا، بس الإيقاف ما اتسجّلش في الدفتر',
      });
    }

    if (action === 'release') {
      const record = await recordLedgerEvent({
        eventType: 'emergency_stop_released',
        source: 'owner',
        payload: { reason: typeof reason === 'string' && reason ? reason : 'من لوحة المالك' },
        companyId,
      });

      if (!record.ok) {
        return NextResponse.json({ success: false, error: record.error }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        recorded: true,
        data: { stopped: false, at: timestamp },
        message: 'الإيقاف اترفع — الشغل يقدر يرجع',
      });
    }

    return NextResponse.json(
      { success: false, error: 'مطلوب «إيقاف» أو «رفع الإيقاف»' },
      { status: 400 },
    );
  } catch (error) {
    console.error('[EmergencyStop] POST error:', error);
    return NextResponse.json({ success: false, error: 'الإيقاف وقف — سبب الخطأ اتسجّل في اللوج' }, { status: 500 });
  }
}
