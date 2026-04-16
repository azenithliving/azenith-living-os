/**
 * Proactive Cron Jobs for Ultimate Agent
 * Runs hourly checks, daily reports via WhatsApp
 * Uses Vercel Cron or node-cron
 */

import { runProactiveCheck, generateDailyReport } from "../ultimate-agent/agent-core";
import { sendWhatsApp } from "../automation"; // Assume WhatsApp service

export interface CronConfig {
  proactiveInterval: string; // "0 */1 * * *" (hourly)
  dailyReportHour: number; // 21 (9PM)
  whatsappNumber: string; // "+20xxxxxxxxx"
}

const config: CronConfig = {
  proactiveInterval: "0 */1 * * *",
  dailyReportHour: 21,
  whatsappNumber: process.env.WHATSAPP_ADMIN || "+201234567890"
};

let isRunning = false;

// Hourly proactive check
export async function startProactiveCron() {
  if (isRunning) return;
  isRunning = true;

  // Vercel Cron endpoint trigger or node-cron
  const cron = require('node-cron');
  cron.schedule(config.proactiveInterval, async () => {
    console.log('🕐 Hourly proactive check...');
    const result = await runProactiveCheck();
    if (result.success && result.data.anomalies?.length > 0) {
      await sendWhatsApp(config.whatsappNumber, `⚠️ شذوذ مكتشفة: ${result.data.anomalies.length}\n${JSON.stringify(result.data.anomalies.slice(0,3))}`);
    }
  });
}

// Daily report at 9PM
export async function startDailyReportCron() {
  const cron = require('node-cron');
  cron.schedule("0 21 * * *", async () => {
    console.log('📊 Daily report...');
    const report = await generateDailyReport();
    if (report.success) {
      await sendWhatsApp(config.whatsappNumber, report.message);
    }
  });
}

// Start all crons
export function startAllCrons() {
  startProactiveCron();
  startDailyReportCron();
  console.log('✅ Proactive crons started');
}

// Manual trigger for dev
export async function triggerProactiveNow(): Promise<string> {
  const result = await runProactiveCheck();
  return result.success ? "Proactive check complete" : "Failed";
}

