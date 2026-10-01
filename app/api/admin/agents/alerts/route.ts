/**
 * GET  /api/admin/agents/alerts — the newest trouble the store recorded and nobody
 *      has acknowledged yet, in the words the owner reads.
 * POST /api/admin/agents/alerts — acknowledge one by id.
 *
 * There is no alert table: the ledger already is one. Every surface that reports
 * trouble writes `ops_sync_events`, so this door reads that ledger through the single
 * rule in `lib/ops/alerts.ts` and writes the acknowledgement back as an event of its
 * own. Nothing new has to be kept in sync, and a second counter never appears.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-api-guard";
import { resolveAdminCompanyId } from "@/lib/admin-company";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  ALERT_ACK_TYPE,
  ALERT_EVENT_TYPES,
  alertLabel,
  alertSourceLabel,
} from "@/lib/ops/alerts";

export const dynamic = "force-dynamic";

/** Trouble older than this is yesterday's news, not a red strip on his screen. */
const ALERT_WINDOW_MS = 60 * 60 * 1000;

function publicAlert(row: Record<string, any>) {
  return {
    id: Number(row.id),
    label: alertLabel(String(row.event_type ?? "")),
    who: alertSourceLabel(row.source_agent),
    at: row.created_at ?? null,
    note: typeof row.payload?.summary === "string" ? String(row.payload.summary).slice(0, 160) : "",
  };
}

export async function GET() {
  const { unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const companyId = await resolveAdminCompanyId();
  const supabase = getSupabaseAdminClient();
  if (!companyId || !supabase) {
    return NextResponse.json({ success: false, error: "الدفتر غير متصل دلوقتي" }, { status: 503 });
  }

  const since = new Date(Date.now() - ALERT_WINDOW_MS).toISOString();

  const [alerts, acks] = await Promise.all([
    supabase
      .from("ops_sync_events")
      .select("id,event_type,source_agent,payload,created_at")
      .eq("company_id", companyId)
      .in("event_type", [...ALERT_EVENT_TYPES])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("ops_sync_events")
      .select("payload")
      .eq("company_id", companyId)
      .eq("event_type", ALERT_ACK_TYPE)
      .gte("created_at", since)
      .limit(500),
  ]);

  const failures = [alerts.error, acks.error].filter(Boolean);
  if (failures.length) {
    return NextResponse.json({ success: false, error: "الدفتر ما ردّش" }, { status: 500 });
  }

  const acknowledged = new Set(
    (acks.data ?? []).map((r: any) => String(r?.payload?.alert_id ?? ""))
  );
  const open = (alerts.data ?? []).filter((r: any) => !acknowledged.has(String(r.id)));

  return NextResponse.json({
    success: true,
    count: open.length,
    alert: open.length ? publicAlert(open[0]) : null,
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
  if (!companyId || !supabase) {
    return NextResponse.json({ success: false, error: "الدفتر غير متصل دلوقتي" }, { status: 503 });
  }

  const { error } = await supabase.from("ops_sync_events").insert({
    company_id: companyId,
    event_type: ALERT_ACK_TYPE,
    source_agent: "owner",
    target_agents: [],
    payload: { alert_id: alertId },
  });

  if (error) {
    return NextResponse.json({ success: false, error: "الدفتر رفض التسجيل" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
