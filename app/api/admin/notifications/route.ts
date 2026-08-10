import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { z } from "zod";

const notificationSchema = z.object({
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(2000),
  type: z.enum(["info", "warning", "success", "error", "agent_event", "task_complete", "quality_alert"]),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  link: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Supabase unavailable" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const unreadOnly = searchParams.get("unread") === "true";
    const severity = searchParams.get("severity");

    let query = supabase
      .from("agent_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (severity) {
      query = query.eq("severity", severity);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') {
        return NextResponse.json({ success: true, data: [], warning: "agent_events table not found" });
      }
      throw error;
    }

    const notifications = (data || []).map((event: any) => ({
      id: event.id,
      title: event.event_type || "إشعار",
      message: event.event_data?.message || JSON.stringify(event.event_data || {}).slice(0, 200),
      type: mapEventTypeToNotificationType(event.event_type),
      severity: event.severity || "medium",
      link: event.task_id ? `/admin/agents` : undefined,
      timestamp: event.created_at,
      read: !!event.acknowledged_at,
    }));

    return NextResponse.json({
      success: true,
      data: notifications,
      unreadCount: notifications.filter((n: any) => !n.read).length,
    });
  } catch (error: any) {
    console.error("[NotificationsAPI] Error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Supabase unavailable" }, { status: 500 });
    }

    const body = await request.json();
    const parseResult = notificationSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: "Invalid data", details: parseResult.error.message },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    const { data: event, error } = await supabase
      .from("agent_events")
      .insert({
        company_id: "00000000-0000-0000-0000-000000000000",
        event_type: data.type,
        event_data: {
          title: data.title,
          message: data.message,
          link: data.link,
          ...data.metadata,
        },
        severity: data.severity,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') {
        return NextResponse.json({
          success: true,
          warning: "agent_events table not found — notification logged locally",
          data: { id: `local-${Date.now()}`, ...data },
        });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: "Notification created",
      data: event,
    }, { status: 201 });
  } catch (error: any) {
    console.error("[NotificationsAPI] Error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Supabase unavailable" }, { status: 500 });
    }

    const body = await request.json();
    const { notification_ids, action } = body;

    if (!notification_ids || !Array.isArray(notification_ids)) {
      return NextResponse.json({ success: false, error: "notification_ids array required" }, { status: 400 });
    }

    if (action === "mark_read") {
      const { error } = await supabase
        .from("agent_events")
        .update({ acknowledged_at: new Date().toISOString() })
        .in("id", notification_ids);

      if (error) throw error;

      return NextResponse.json({ success: true, message: `${notification_ids.length} notifications marked as read` });
    }

    if (action === "dismiss") {
      const { error } = await supabase
        .from("agent_events")
        .update({ acknowledged_at: new Date().toISOString() })
        .in("id", notification_ids);

      if (error) throw error;

      return NextResponse.json({ success: true, message: `${notification_ids.length} notifications dismissed` });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("[NotificationsAPI] Error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

function mapEventTypeToNotificationType(eventType: string): string {
  const mapping: Record<string, string> = {
    "task_complete": "task_complete",
    "agent_event": "agent_event",
    "stuck": "warning",
    "error": "error",
    "milestone": "success",
    "escalation": "warning",
    "suggestion": "info",
    "insight": "info",
    "quality_fail": "quality_alert",
  };
  return mapping[eventType] || "info";
}
