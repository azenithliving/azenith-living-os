/**
 * Rollback door
 *
 * The owner's chat sends this door the id of one execution and asks for what that execution changed
 * to go back. It does not invent a history of its own: the settings desk wrote the record it reads,
 * in the drawer the store already keeps history in.
 *
 * Measured 2026-11-06, this door used to read `content_revisions` — a table the record has never had
 * (PGRST205) — and to filter `site_settings.id`, a column that does not exist either. It also had no
 * branch for the `executionId` the chat actually sends, so the button answered «Invalid rollback
 * type» every single time it was pressed.
 */

import { rollbackSettingsForExecution } from "@/lib/site-settings-desk";
import { logAuditEvent } from "@/lib/ultimate-agent/security-manager";

function answer(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const executionId = typeof body?.executionId === "string" ? body.executionId.trim() : "";
    const revisionId = typeof body?.revisionId === "string" ? body.revisionId.trim() : "";
    const actor = req.headers.get("x-admin-user-id") || "admin_dashboard";

    if (!executionId && !revisionId) {
      return answer(400, {
        success: false,
        error: "رقم التنفيذ مطلوب — الرجوع بيتعمل بحاجة واحدة مسجّلة، مش بكل التاريخ",
      });
    }

    if (!executionId) {
      // Named rather than guessed: a revision id belongs to a drawer this store does not have, and
      // telling the owner «not found» would send him looking for a row that never existed.
      return answer(400, {
        success: false,
        error:
          "الرجوع بالرقم ده مش متعمل: دفتر المراجعات مش موجود في المخزن — الرجوع بيتعمل برقم التنفيذ، والسجل الموجود هو دفتر الأحداث",
      });
    }

    const result = await rollbackSettingsForExecution(executionId, actor);

    await logAuditEvent(
      "rollback",
      result.appliedCount ? `تراجع عن ${result.appliedCount} إعداد في التنفيذ ${executionId}` : `مفيش تغيير مسجّل للتنفيذ ${executionId}`,
      actor,
      { executionId, keys: result.keys, appliedCount: result.appliedCount },
      result.ok ? "success" : "failure"
    );

    if (!result.ok) {
      return answer(result.appliedCount === 0 ? 404 : 500, {
        success: false,
        error: result.message,
        data: { executionId, keys: result.keys, appliedCount: result.appliedCount },
      });
    }

    return answer(200, {
      success: true,
      message: result.message,
      data: {
        executionId,
        keys: result.keys,
        appliedCount: result.appliedCount,
        rolledBackAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[Rollback API] Error:", error);
    return answer(500, {
      success: false,
      error:
        "الرجوع ما اتقارش — السبب اتسجل في اللوج. الأقسام اللي بتتراجع بتتحفظ في دفاتر الأقسام نفسها، وسجل تغييرها لسه ما اتبناش.",
    });
  }
}
