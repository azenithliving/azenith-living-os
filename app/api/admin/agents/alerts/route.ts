/**
 * GET  /api/admin/agents/alerts — the newest trouble the store recorded and nobody
 *      has acknowledged yet, in the words the owner reads.
 * POST /api/admin/agents/alerts — acknowledge one by id.
 *
 * There is no alert table: the ledger already is one, and `lib/ops/alerts.ts` holds the
 * one reading rule over it. This door is a thin surface — it asks the rule for what is
 * open and shows the newest. The old house's notification strip asks the same rule, so
 * the two can never disagree about what counts as an emergency or how many are waiting.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-api-guard";
import { resolveAdminCompanyId } from "@/lib/admin-company";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { acknowledgeAlerts, readOpenAlerts } from "@/lib/ops/alerts";

export const dynamic = "force-dynamic";

function unavailable() {
  return NextResponse.json({ success: false, error: "الدفتر غير متصل دلوقتي" }, { status: 503 });
}

export async function GET() {
  const { unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const companyId = await resolveAdminCompanyId();
  const supabase = getSupabaseAdminClient();
  if (!companyId || !supabase) return unavailable();

  const read = await readOpenAlerts(supabase, companyId);
  if (!read.ok) {
    return NextResponse.json({ success: false, error: read.error }, { status: 500 });
  }

  const newest = read.alerts[0];

  return NextResponse.json({
    success: true,
    count: read.alerts.length,
    alert: newest
      ? { id: newest.id, label: newest.label, who: newest.who, at: newest.at, note: newest.note }
      : null,
  });
}

export async function POST(request: NextRequest) {
  const { unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "طلب غير مفهوم" }, { status: 400 });
  }

  const alertId = Number(body?.alert_id);
  if (!Number.isFinite(alertId) || alertId <= 0) {
    return NextResponse.json({ success: false, error: "رقم القرار غير موجود" }, { status: 400 });
  }

  const companyId = await resolveAdminCompanyId();
  const supabase = getSupabaseAdminClient();
  if (!companyId || !supabase) return unavailable();

  const ack = await acknowledgeAlerts(supabase, companyId, [alertId]);
  if (!ack.ok) {
    return NextResponse.json({ success: false, error: ack.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
