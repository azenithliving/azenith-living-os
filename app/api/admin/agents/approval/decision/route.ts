/**
 * POST /api/admin/agents/approval/decision
 * بوابة الموافقات — يستدعي approveRequest/rejectRequest من approval-system.ts
 * ويُنفّذ الأداة فعلياً بعد الموافقة
 */

import { NextRequest, NextResponse } from "next/server";
import { approveRequest, rejectRequest } from "@/lib/agent-tools/approval-system";
import { sendTelegramMessage } from "@/lib/telegram-config";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { approval_id, decision, reason } = body;

    if (!approval_id || !decision) {
      return NextResponse.json(
        { success: false, error: "approval_id و decision مطلوبان" },
        { status: 400 }
      );
    }

    if (decision !== "approved" && decision !== "rejected") {
      return NextResponse.json(
        { success: false, error: "decision يجب أن يكون approved أو rejected" },
        { status: 400 }
      );
    }

    // المنفّذ = admin (في المستقبل يمكن ربطه بالجلسة الحقيقية)
    const actor = "admin";

    if (decision === "approved") {
      const result = await approveRequest(approval_id, actor, reason);

      // إشعار Telegram عند الموافقة وتنفيذ الأداة
      try {
        const statusMsg = result.executionResult?.success
          ? "✅ تم التنفيذ بنجاح"
          : `⚠️ تمت الموافقة لكن فشل التنفيذ: ${result.executionResult?.error || "خطأ غير معروف"}`;

        await sendTelegramMessage(
          `🔑 موافقة على طلب\n\nالطلب: ${approval_id}\n${statusMsg}`
        );
      } catch {
        // الإشعار اختياري — لا يوقف التنفيذ
      }

      return NextResponse.json({
        success: result.success,
        message: result.message,
        executed: true,
        executionResult: result.executionResult,
      });

    } else {
      // rejected
      const result = await rejectRequest(approval_id, actor, reason);

      // إشعار Telegram عند الرفض
      try {
        await sendTelegramMessage(
          `❌ رفض طلب\n\nالطلب: ${approval_id}\nالسبب: ${reason || "لم يُحدَّد"}`
        );
      } catch {
        // الإشعار اختياري
      }

      return NextResponse.json({
        success: result.success,
        message: result.message,
        executed: false,
      });
    }

  } catch (error) {
    console.error("[approval/decision] خطأ:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "خطأ غير معروف",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/agents/approval/decision
 * للاختبار فقط — يُعيد حالة الـ endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: "ready",
    message: "POST بـ { approval_id, decision: 'approved'|'rejected', reason? }",
  });
}
