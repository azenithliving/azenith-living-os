import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveAdminCompanyId } from "@/lib/admin-company";
import { AdminApiAuthError, requireAdminApiAccess } from "@/lib/admin-api-auth";
import { z } from "zod";

const notificationSchema = z.object({
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(2000),
  type: z.enum(["info", "warning", "success", "error", "agent_event", "task_complete", "quality_alert"]),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  link: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

function authError(error: unknown) {
  return error instanceof AdminApiAuthError
    ? NextResponse.json({ success: false, error: error.message }, { status: error.status })
    : null;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminApiAccess(request);
    const supabase = getSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Supabase unavailable" }, { status: 503 });

    const params = new URL(request.url).searchParams;
    const limit = Math.min(Math.max(Number(params.get("limit") || 20), 1), 100);
    const unreadOnly = params.get("unread") === "true";
    const severity = params.get("severity");

    let query = supabase.from("agent_events").select("*").order("created_at", { ascending: false }).limit(limit);
    if (severity) query = query.eq("severity", severity);
    if (unreadOnly) query = query.is("acknowledged_at", null);

    const { data, error } = await query;
    if (error) {
      if (error.code === "PGRST205" || error.code === "42P01") {
        return NextResponse.json({ success: true, data: [], warning: "agent_events table not found" });
      }
      throw error;
    }

    const notifications = (data || []).map((event: any) => ({
      id: event.id,
      title: event.event_data?.title || event.event_type || "إشعار",
      message: event.event_data?.message || JSON.stringify(event.event_data || {}).slice(0, 200),
      type: mapEventTypeToNotificationType(event.event_type),
      severity: event.severity || "medium",
      link: event.event_data?.link || (event.task_id ? "/admin/agents" : undefined),
      timestamp: event.created_at,
      read: Boolean(event.acknowledged_at),
    }));

    return NextResponse.json({ success: true, data: notifications, unreadCount: notifications.filter((n) => !n.read).length });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    console.error("[NotificationsAPI] GET error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminApiAccess(request);
    const supabase = getSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Supabase unavailable" }, { status: 503 });
    const parsed = notificationSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid data", details: parsed.error.message }, { status: 400 });

    const data = parsed.data;
    const companyId = await resolveAdminCompanyId();
    if (!companyId) return NextResponse.json({ success: false, error: "Admin company is not configured" }, { status: 409 });

    const { data: event, error } = await supabase.from("agent_events").insert({
      company_id: companyId,
      event_type: data.type,
      event_data: { title: data.title, message: data.message, link: data.link, ...data.metadata },
      severity: data.severity,
      created_at: new Date().toISOString(),
    }).select().single();
    if (error) throw error;
    return NextResponse.json({ success: true, message: "Notification created", data: event }, { status: 201 });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    console.error("[NotificationsAPI] POST error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdminApiAccess(request);
    const supabase = getSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Supabase unavailable" }, { status: 503 });
    const body = await request.json();
    if (!Array.isArray(body.notification_ids) || body.notification_ids.length === 0) {
      return NextResponse.json({ success: false, error: "notification_ids array required" }, { status: 400 });
    }
    if (body.action !== "mark_read" && body.action !== "dismiss") {
      return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }
    const { error } = await supabase.from("agent_events").update({ acknowledged_at: new Date().toISOString() }).in("id", body.notification_ids);
    if (error) throw error;
    return NextResponse.json({ success: true, updated: body.notification_ids.length });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    console.error("[NotificationsAPI] PATCH error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

function mapEventTypeToNotificationType(eventType: string): string {
  const mapping: Record<string, string> = { task_complete: "task_complete", agent_event: "agent_event", stuck: "warning", error: "error", milestone: "success", escalation: "warning", suggestion: "info", insight: "info", quality_fail: "quality_alert" };
  return mapping[eventType] || "info";
}
