import { NextRequest, NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cron-auth";
import { buildAdminDailyReport, persistDailyReport } from "@/lib/admin-daily-report";
import { createAdminProposal } from "@/lib/admin-sovereign-mind";

export const maxDuration = 60;

async function run(request: NextRequest) {
  const unauthorized = assertCronAuthorized(request);
  if (unauthorized) return unauthorized;

  const report = await buildAdminDailyReport();
  const stored = await persistDailyReport(report);

  const ownerEmail = process.env.MASTER_ADMIN_EMAILS?.split(",")[0]?.trim();
  let proposalCreated = false;
  let proposalId: string | null = null;
  let proposalError: string | null = null;
  // Only a report carrying something broken asks for his signature. Gating on the pending pile
  // made this job create the paper it was counting, every day, forever.
  if (report.needsReview) {
    const proposal = await createAdminProposal({
      title: "تقرير يومي فيه حاجة محتاجة مراجعتك",
      description: report.fullTextAr.slice(0, 1500),
      reasoning: `تقرير مجدول يومي · ${report.reviewReasons.join(" · ")}`,
      userMessage: "اعرض إحصائيات آخر يوم وافحص صحة النظام",
      intent: { kind: "analytics", analyticsDays: 7, confidence: 0.9 },
      userEmail: ownerEmail,
      proactive: true,
    });
    proposalCreated = proposal.success;
    proposalId = proposal.success ? (proposal.requestId ?? null) : null;
    proposalError = proposal.success ? null : proposal.error || "الورقة ما اتسجلتش";
  }

  return NextResponse.json({
    success: true,
    generatedAt: report.generatedAt,
    pendingApprovals: report.pendingApprovals,
    needsReview: report.needsReview,
    reviewReasons: report.reviewReasons,
    proposalCreated,
    proposalId,
    proposalError,
    memoryStored: stored.ok,
    memoryError: stored.ok ? null : stored.error,
    preview: report.fullTextAr.slice(0, 400),
  });
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
