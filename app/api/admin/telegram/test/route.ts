/**
 * POST /api/admin/telegram/test
 * Sends a test message to a specific chatId using the stored or provided bot token.
 * Body: { chatId: string; message?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

interface TelegramConfig {
  botToken: string;
  enabled: boolean;
  chats: Array<{ id: string; label: string; chatId: string; isDefault: boolean }>;
}

async function resolveToken(): Promise<string | null> {
  // 1. Try DB config first
  try {
    const { data } = await supabaseService
      .from("site_settings")
      .select("value")
      .eq("key", "telegram_config")
      .maybeSingle() as { data: { value: unknown } | null; error: any };

    const cfg = data?.value as TelegramConfig | null;
    if (cfg?.botToken) return cfg.botToken;
  } catch {
    // fall through to env
  }

  // 2. Fallback to env
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatId, message } = body as { chatId?: string; message?: string };

    if (!chatId?.trim()) {
      return NextResponse.json(
        { success: false, error: "chatId مطلوب" },
        { status: 400 }
      );
    }

    const token = await resolveToken();
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Bot Token غير موجود — أضفه في إعدادات تليجرام أو في TELEGRAM_BOT_TOKEN",
        },
        { status: 400 }
      );
    }

    const text =
      message?.trim() ||
      `🔔 <b>رسالة اختبار من Azenith Living</b>\n\n` +
        `✅ تليجرام متصل ويعمل بشكل صحيح.\n` +
        `🕐 ${new Date().toLocaleString("ar-EG")}`;

    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId.trim(),
          text,
          parse_mode: "HTML",
          disable_notification: false,
        }),
      }
    );

    const payload = await res.json().catch(() => ({}));

    if (!res.ok || !payload.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            payload.description ||
            `Telegram API error (HTTP ${res.status})`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "تم إرسال الرسالة التجريبية بنجاح ✅",
      messageId: payload.result?.message_id,
    });
  } catch (err: any) {
    console.error("[Telegram Test] error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
