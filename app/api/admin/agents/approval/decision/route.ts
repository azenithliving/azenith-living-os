/**
 * POST /api/admin/agents/approval/decision
 * بوابة الموافقات — يستدعي approveRequest/rejectRequest من approval-system.ts
 * ويُنفّذ الأداة فعلياً بعد الموافقة
 */

import { NextRequest, NextResponse } from "next/server";
import { approveRequest, rejectRequest } from "@/lib/agent-tools/approval-system";

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

      // إشعار Telegram
      const statusMsg = result.executionResult?.success
        ? "تم التنفيذ بنجاح"
        : `فشل التنفيذ: ${result.executionResult?.error || "خطأ غير معروف"}`;

      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/admin/agents/notify`,
          {
            method:  "POST",
            headers: { "Content-Type": "application/json", "X-Internal-Key": process.env.INTERNAL_API_KEY || "" },
            body:    JSON.stringify({
              event:    result.executionResult?.success ? "task_completed" : "task_failed",
              agent:    "system",
              title:    "موافقة على طلب",
              message:  `${statusMsg}\nالطلب: ${approval_id}`,
              severity: result.executionResult?.success ? "info" : "warning",
            }),
          }
        );
      } catch { /* الإشعار اختياري */ }

      return NextResponse.json({
        success: result.success,
        message: result.message,
        executed: true,
        executionResult: result.executionResult,
      });

    } else {
      const result = await rejectRequest(approval_id, actor, reason);

      // إشعار Telegram عند الرفض
      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/admin/agents/notify`,
          {
            method:  "POST",
            headers: { "Content-Type": "application/json", "X-Internal-Key": process.env.INTERNAL_API_KEY || "" },
            body:    JSON.stringify({
              event:   "custom",
              agent:   "system",
              title:   "رفض طلب",
              message: `تم رفض الطلب: ${approval_id}\nالسبب: ${reason || "لم يُحدَّد"}`,
              severity:"info",
            }),
          }
        );
      } catch { /* الإشعار اختياري */ }

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
