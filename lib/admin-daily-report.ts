/**
 * Daily executive report for the admin assistant (cron + on-demand).
 */

import { getAnalyticsReport, getSystemHealth } from "@/lib/architect-tools";
import { getCapabilityMaturityReport } from "@/lib/admin-capability-evolution";
import { arNum } from "@/lib/ops/metricLabels";
import { listPendingAdminProposals } from "@/lib/admin-sovereign-mind";
import { createClient } from "@supabase/supabase-js";

export interface AdminDailyReport {
  generatedAt: string;
  healthMessage: string;
  analyticsMessage: string;
  maturitySummary: string;
  pendingApprovals: number;
  fullTextAr: string;
}

/** Arabic counts the way the number asks, not the way English does: ٢٧ اقتراح, not ٢٧ اقتراحات. */
function waitingWord(count: number): string {
  if (count === 2) return "اقتراحين مستنيين";
  if (count >= 3 && count <= 10) return "اقتراحات مستنية";
  return "اقتراح مستني";
}

export async function buildAdminDailyReport(): Promise<AdminDailyReport> {
  const [health, analytics, pending] = await Promise.all([
    getSystemHealth().catch(() => ({ success: false, message: "صحة: غير متاح" })),
    getAnalyticsReport({ days: 7 }).catch(() => ({ success: false, message: "تحليلات: غير متاح" })),
    listPendingAdminProposals(50),
  ]);

  const maturity = getCapabilityMaturityReport();
  const generatedAt = new Date().toISOString();

  const fullTextAr = [
    `📋 **تقرير أزينث ليفينج اليومي** — ${new Date().toLocaleDateString("ar-EG")}`,
    "",
    health.message || "—",
    "",
    analytics.message || "—",
    "",
    `🧠 نضج المساعد (${arNum(maturity.score)} من ${arNum(100)}): ${maturity.summaryAr}`,
    "",
    pending.length > 0
      ? `⏳ ${arNum(pending.length)} ${waitingWord(pending.length)} موافقتك في «عقل النظام»`
      : "✅ مفيش اقتراحات مستنية",
  ].join("\n");

  return {
    generatedAt,
    healthMessage: health.message || "",
    analyticsMessage: analytics.message || "",
    maturitySummary: maturity.summaryAr,
    pendingApprovals: pending.length,
    fullTextAr,
  };
}

export async function persistDailyReport(report: AdminDailyReport): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await supabase.from("agent_memory").insert({
    type: "report",
    category: "admin_daily_report",
    content: report.fullTextAr.slice(0, 8000),
    context: report,
    priority: "normal",
    company_id: process.env.MASTER_COMPANY_ID || null,
  });
}
