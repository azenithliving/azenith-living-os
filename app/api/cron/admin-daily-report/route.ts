import { NextRequest, NextResponse } from "next/server";
import { buildAdminDailyReport, persistDailyReport } from "@/lib/admin-daily-report";
import { createAdminProposal } from "@/lib/admin-sovereign-mind";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report = await buildAdminDailyReport();
  await persistDailyReport(report);

  const ownerEmail = process.env.MASTER_ADMIN_EMAILS?.split(",")[0]?.trim();
  if (report.pendingApprovals > 0) {
    await createAdminProposal({
      title: "تقرير يومي + اقتراحات معلّقة",
      description: report.fullTextAr.slice(0, 1500),
      reasoning: "تقرير مجدول يومي",
      userMessage: "اعرض إحصائيات آخر يوم وافحص صحة النظام",
      intent: { kind: "analytics", analyticsDays: 7, confidence: 0.9 },
      userEmail: ownerEmail,
      proactive: true,
    });
  }

  return NextResponse.json({
    success: true,
    generatedAt: report.generatedAt,
    pendingApprovals: report.pendingApprovals,
    preview: report.fullTextAr.slice(0, 400),
  });
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    status: "ready",
    description: "Daily admin executive report",
    schedule: "0 8 * * * (configure in vercel.json)",
  });
}
