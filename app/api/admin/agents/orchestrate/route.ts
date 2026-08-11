import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { delegateToAaca, shouldDelegateToAaca } from "@/lib/aaca-client";
import { executeTool } from "@/lib/agent-tools/tool-registry";

export const maxDuration = 60;

/**
 * POST /api/admin/agents/orchestrate
 * يدعم وضعين:
 *   1. { message } — تفويض للـ AACA
 *   2. { tool, params } — تنفيذ أداة مباشرة من tool-registry
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // ── وضع تنفيذ الأداة المباشر ───────────────────────────────────
    if (body.tool) {
      const toolName = body.tool as string;
      const params   = (body.params || {}) as Record<string, unknown>;
      const context  = {
        actorUserId: user.email,
        companyId:   '00000000-0000-0000-0000-000000000000',
        executionId: crypto.randomUUID(),
      };

      const result = await executeTool(toolName, params, context);

      return NextResponse.json({
        success: result.success,
        message: result.message,
        data:    result.data,
        error:   result.error,
        requiresApproval: result.requiresApproval,
        approvalId:       result.approvalId,
      });
    }

    // ── وضع الرسالة الطبيعية ──────────────────────────────────────
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json(
        { success: false, error: "message أو tool مطلوب" },
        { status: 400 }
      );
    }

    const createdBy = user.email;
    const prefixed  = shouldDelegateToAaca(message) ? message : `/aaca ${message}`;
    const result    = await delegateToAaca(prefixed, createdBy);

    return NextResponse.json({ success: result.delegated, ...result });

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Orchestration failed",
      },
      { status: 500 }
    );
  }
}
