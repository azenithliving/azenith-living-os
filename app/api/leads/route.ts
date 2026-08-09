import { NextResponse } from "next/server";

import { leadSubmissionSchema, persistLeadSubmission } from "@/lib/leads";
import { normalizeHost } from "@/lib/tenant";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = leadSubmissionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          message: "البيانات المرسلة غير مكتملة.",
          issues: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const host = normalizeHost(
      request.headers.get("x-forwarded-host") ??
        request.headers.get("host") ??
        request.headers.get("x-original-host"),
    );

    const result = await persistLeadSubmission(parsed.data, host);

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: "لا توجد شركة مفعلة لهذا الدومين حتى الآن. أضف الشركة من لوحة التحكم ثم أعد المحاولة.",
          reason: result.reason,
        },
        { status: 409 },
      );
    }

    // ── Telegram Notification on Lead Success ──────────────────────────────
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;
    const telegramEnabled = process.env.TELEGRAM_ENABLED === "true";

    if (telegramEnabled && telegramToken && telegramChatId) {
      const clientName = parsed.data.fullName || "غير محدد";
      const clientPhone = parsed.data.phone || "غير محدد";
      const clientEmail = parsed.data.email || "غير محدد";
      const clientNotes = parsed.data.notes || "لا توجد ملاحظات";

      const tgMessage = `
🏛️ <b>طلب تصميم جديد | أزينث ليفينج</b>

👤 <b>العميل:</b> ${clientName}
📞 <b>الهاتف:</b> ${clientPhone}
📧 <b>البريد:</b> ${clientEmail}

📝 <b>تفاصيل كراسة متطلبات المشروع:</b>
${clientNotes}

<i>تم الحفظ بنجاح في قاعدة البيانات وتوليد كراسة الشروط تلقائياً.</i>
      `.trim();

      fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: tgMessage,
          parse_mode: "HTML",
        }),
      }).catch((err) => {
        console.error("Failed to send Telegram lead alert:", err);
      });
    }

    return NextResponse.json({
      ok: true,
      requestId: result.requestId,
      userId: result.userId,
      companyId: result.companyId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";

    if (message.includes("Supabase schema is not initialized")) {
      return NextResponse.json(
        {
          ok: false,
          message: "قاعدة البيانات على Supabase لم يتم تجهيزها بعد. طبّق ملف migrations أولًا ثم أعد المحاولة.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message,
      },
      { status: 500 },
    );
  }
}
