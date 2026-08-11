/**
 * POST /api/admin/agents/notify
 * يُرسل إشعار Telegram عند أي حدث من الوكلاء
 *
 * يُستدعى داخلياً من:
 *   - approval/decision (عند الموافقة/الرفض)
 *   - أي agent task تكتمل
 *   - proactive agent عند اكتشاف مشكلة
 *
 * الـ body:
 *   { event: 'task_completed' | 'approval_needed' | 'task_failed' | 'proactive_alert' | 'custom',
 *     agent?: string, title?: string, message: string, severity?: 'info' | 'warning' | 'critical' }
 */

import { NextRequest, NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram-config";

type EventType =
  | "task_completed"
  | "approval_needed"
  | "task_failed"
  | "proactive_alert"
  | "agent_online"
  | "custom";

const EMOJIS: Record<EventType, string> = {
  task_completed:  "✅",
  approval_needed: "🔑",
  task_failed:     "❌",
  proactive_alert: "⚡",
  agent_online:    "🟢",
  custom:          "📢",
};

const SEVERITY_PREFIX: Record<string, string> = {
  info:     "",
  warning:  "⚠️ ",
  critical: "🚨 ",
};

export async function POST(request: NextRequest) {
  try {
    // التحقق من المفتاح الداخلي (يمكن استدعاؤه من الخادم فقط)
    const internalKey = request.headers.get("X-Internal-Key");
    const expectedKey = process.env.INTERNAL_API_KEY;

    // إذا كان المفتاح مضبوطاً، نتحقق منه
    if (expectedKey && internalKey !== expectedKey) {
      // إذا كان الطلب من admin panel (authenticated) نسمح له
      const origin = request.headers.get("origin") || "";
      const isLocalAdmin = origin.includes("localhost") ||
                           origin.includes(process.env.NEXT_PUBLIC_APP_URL || "");
      if (!isLocalAdmin) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await request.json();
    const {
      event    = "custom" as EventType,
      agent    = "",
      title    = "",
      message  = "",
      severity = "info",
      metadata,
    } = body as {
      event?:    EventType;
      agent?:    string;
      title?:    string;
      message:   string;
      severity?: "info" | "warning" | "critical";
      metadata?: Record<string, unknown>;
    };

    if (!message) {
      return NextResponse.json({ success: false, error: "message مطلوب" }, { status: 400 });
    }

    // بناء نص الإشعار
    const emoji  = EMOJIS[event] ?? "📢";
    const prefix = SEVERITY_PREFIX[severity] ?? "";
    const agentTag = agent ? `[${agent.toUpperCase()}] ` : "";

    let text = `${prefix}${emoji} ${agentTag}${title || event}\n\n${message}`;

    if (metadata && Object.keys(metadata).length > 0) {
      const details = Object.entries(metadata)
        .slice(0, 5)
        .map(([k, v]) => `• ${k}: ${String(v).slice(0, 80)}`)
        .join("\n");
      text += `\n\n${details}`;
    }

    text += `\n\n🕐 ${new Date().toLocaleString("ar-EG")}`;

    const sent = await sendTelegramMessage(text);

    return NextResponse.json({ success: sent, message: sent ? "تم الإرسال" : "لم يتم الإرسال (التليجرام غير مفعّل)" });

  } catch (error) {
    console.error("[notify]", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "خطأ" },
      { status: 500 }
    );
  }
}
