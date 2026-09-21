/**
 * These helpers exist for a long-running Node process only.
 * They are not registered in vercel.json and do not send WhatsApp.
 * Trigger work through /api/cron/* with CRON_SECRET.
 */

import { runProactiveCheck, generateDailyReport } from "../ultimate-agent/agent-core";

export async function triggerProactiveNow(): Promise<{ success: boolean; message: string }> {
  const result = await runProactiveCheck();
  return {
    success: Boolean(result.success),
    message: result.success ? "Proactive check complete" : "Proactive check failed",
  };
}

export async function triggerDailyReportNow(): Promise<{ success: boolean; report: unknown }> {
  const report = await generateDailyReport();
  return { success: Boolean(report), report };
}
