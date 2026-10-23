/**
 * /api/admin/notifications — the old house's alert strip.
 *
 * It used to read `agent_events`, a table that cannot answer what this strip asks:
 * measured on the live record (2026-10-23) it holds 8 columns and 4 rows, every row
 * written by a demo seed on 2026-08-10, and the `severity` / `acknowledged_at` columns
 * the strip read and wrote are not among them — so "mark as read" failed every single
 * time and the four invented alerts could never leave his screen.
 *
 * The store's alerts already have one owner: the ledger, read through the single rule in
 * `lib/ops/alerts.ts`. This door is now a second surface over that rule, so its count
 * and the cockpit's red strip cannot disagree. `agent_events` is read by nobody here.
 */

import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveAdminCompanyId } from "@/lib/admin-company";
import { AdminApiAuthError, requireAdminApiAccess } from "@/lib/admin-api-auth";
import { alertWindowPhrase, acknowledgeAlerts, readOpenAlerts } from "@/lib/ops/alerts";

export const dynamic = "force-dynamic";

function authError(error: unknown) {
  return error instanceof AdminApiAuthError
    ? NextResponse.json(
        { success: false, error: "لازم تكون داخل بلوحة التحكم قبل ما التنبيهات تتقرا" },
        { status: error.status },
      )
    : null;
}

function unavailable() {
  return NextResponse.json({ success: false, error: "الدفتر غير متصل دلوقتي" }, { status: 503 });
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminApiAccess(request);
    const supabase = getSupabaseAdminClient();
    if (!supabase) return unavailable();

    const companyId = await resolveAdminCompanyId();
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "شركة المتجر مش مسجّلة في الإعدادات — فالدفتر ما قريتش" },
        { status: 503 },
      );
    }

    const limit = Number(new URL(request.url).searchParams.get("limit") || 20);
    const read = await readOpenAlerts(supabase, companyId, limit);
    if (!read.ok) {
      return NextResponse.json({ success: false, error: read.error }, { status: 500 });
    }

    const notifications = read.alerts.map((alert) => ({
      id: String(alert.id),
      title: alert.label || "تنبيه مسجّل في دفتر المتجر",
      message: [alert.who, alert.note].filter(Boolean).join(" — "),
      type: "agent_event",
      timestamp: alert.at,
      read: false,
    }));

    return NextResponse.json({
      success: true,
      data: notifications,
      unreadCount: notifications.length,
      restingLine: read.alerts.length
        ? null
        : `مفيش تنبيه مفتوح في دفتر المتجر — الشريط بيعرض ${alertWindowPhrase()}`,
    });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    console.error("[NotificationsAPI] GET error:", error);
    return NextResponse.json({ success: false, error: "التنبيهات ما قريتش — سبب الخطأ اتسجّل في اللوج" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdminApiAccess(request);
    const supabase = getSupabaseAdminClient();
    if (!supabase) return unavailable();

    const companyId = await resolveAdminCompanyId();
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "شركة المتجر مش مسجّلة في الإعدادات — فما اتسجّلت حاجة" },
        { status: 503 },
      );
    }

    const body = await request.json();
    const ids = Array.isArray(body?.notification_ids)
      ? body.notification_ids.map((value: unknown) => Number(value)).filter((value: number) => Number.isFinite(value) && value > 0)
      : [];
    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: "مفيش رقم تنبيه سليم في الطلب" }, { status: 400 });
    }
    if (body?.action !== "mark_read") {
      return NextResponse.json({ success: false, error: "الحاجة الوحيدة المدعومة هنا: تعليم التنبيه كمقروء" }, { status: 400 });
    }

    const ack = await acknowledgeAlerts(supabase, companyId, ids);
    if (!ack.ok) {
      return NextResponse.json({ success: false, error: ack.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated: ack.acked });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    console.error("[NotificationsAPI] PATCH error:", error);
    return NextResponse.json({ success: false, error: "التعليم كمقروء وقف — سبب الخطأ اتسجّل في اللوج" }, { status: 500 });
  }
}
