import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/admin/agent/communication
 * Sends real notifications via Telegram (and optionally WhatsApp)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { message, type } = body;

    if (!message) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    const results: Record<string, unknown> = {};

    // ── 1. Telegram (Primary - always attempt) ──────────────────────────────
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;

    if (telegramToken && telegramChatId) {
      try {
        const telegramRes = await fetch(
          `https://api.telegram.org/bot${telegramToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: telegramChatId,
              text: message,
              parse_mode: "Markdown",
            }),
          }
        );
        const telegramData = await telegramRes.json();
        results.telegram = telegramData.ok ? "✅ sent" : `❌ ${telegramData.description}`;
        console.log("[Communication] Telegram:", results.telegram);
      } catch (err) {
        results.telegram = `❌ Error: ${err instanceof Error ? err.message : String(err)}`;
        console.error("[Communication] Telegram failed:", err);
      }
    } else {
      results.telegram = "⚠️ Token or ChatID not configured";
    }

    // ── 2. Resend Email (Secondary) ─────────────────────────────────────────
    const resendKey = process.env.RESEND_API_KEY;
    const adminEmail = process.env.MASTER_ADMIN_EMAILS?.split(",")[0]?.trim();

    if (resendKey && adminEmail && type === "email") {
      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Azenith AI <onboarding@resend.dev>",
            to: [adminEmail],
            subject: "🔔 استفسار جديد من المستشار الذكي",
            text: message,
          }),
        });
        const emailData = await emailRes.json();
        results.email = emailData.id ? "✅ sent" : `❌ ${JSON.stringify(emailData)}`;
      } catch (err) {
        results.email = `❌ Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("[Communication] Route error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
