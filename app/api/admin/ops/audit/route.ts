/**
 * Qayyim Swarm - Audit API
 * POST /api/admin/ops/audit
 *
 * يستخدم MasterOrchestrator لتشغيل سرب كامل (5 وكلاء) بدل Core وحده
 */

import { NextRequest, NextResponse } from "next/server";
import { masterOrchestrator, qayyimCoreAgent } from "@/lib/ops";
import { getCompanyId, AuditSchema } from "@/lib/ops/api/utils";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = AuditSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.format() }, { status: 400 });
    }

    const { page_path = "/", scope = "full", company_id } = parsed.data;
    const companyId = await getCompanyId(company_id);

    // ── تدقيق Core المباشر (سريع + بيانات حقيقية من DB) ─────────────
    const coreAudit = await qayyimCoreAgent.auditFullSite({
      page_path,
      scope,
      company_id: companyId,
    });

    // ── تدقيق السرب الكامل عبر MasterOrchestrator (5 وكلاء موزعين) ──
    const auditRequest = scope === "full"
      ? `افحص الموقع كله شاملاً: محتوى، صور، سيو، تجربة مستخدم، جودة كود. الصفحة: ${page_path}`
      : `افحص صفحة ${page_path} بعمق: ${scope}`;

    let swarmResult;
    try {
      swarmResult = await masterOrchestrator.execute(auditRequest, {
        company_id: companyId,
        page_path,
        scope,
        audit_mode: true,
      });
    } catch (swarmErr: any) {
      // إذا فشل السرب، نكتفي بنتيجة Core
      console.warn("[Qayyim Audit] Swarm failed, using core only:", swarmErr.message);
      swarmResult = null;
    }

    // ── دمج النتيجتين ────────────────────────────────────────────────
    const result = {
      // نتيجة Core: بيانات DB حقيقية
      core: coreAudit,
      // نتيجة السرب: تحليل متعدد الوكلاء
      swarm: swarmResult
        ? {
            success:      swarmResult.success,
            response:     swarmResult.response,
            evidenceUrls: swarmResult.evidenceUrls,
            version:      swarmResult.version,
            taskId:       swarmResult.taskId,
            draft:        swarmResult.draft ?? null,
          }
        : null,
      // ملخص موحد
      summary: swarmResult?.success
        ? swarmResult.response
        : coreAudit.output ?? ((coreAudit as unknown) as Record<string, unknown>).message as string ?? null,
      evidenceUrls: [
        ...(coreAudit.evidenceUrls ?? []),
        ...(swarmResult?.evidenceUrls ?? []),
      ],
      issuesCount: (coreAudit.data as any)?.issues?.length ?? 0,
    };

    return NextResponse.json({ success: true, result });

  } catch (error: any) {
    console.error("[Qayyim Audit API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Qayyim Audit API — POST with { page_path?, scope?, company_id? }",
  });
}
