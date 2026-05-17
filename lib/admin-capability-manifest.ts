/**
 * Single source of truth for what the unified assistant can do.
 * Used in fallbacks, AI prompts, and scenario audits.
 */

import { TOOL_REGISTRY } from "@/lib/agent-tools/tool-registry";

export const ADMIN_COMMANDS = [
  "add_key",
  "remove_key",
  "list_keys",
  "check_keys",
  "rate_limit",
  "send_notification",
  "show_stats",
  "clear_cache",
  "restart_service",
  "backup_db",
  "evolve",
  "help",
  "search",
  "read",
  "add_backup_key",
  "simulate_key_usage",
] as const;

export function listUltimateToolNames(): string[] {
  return Object.keys(TOOL_REGISTRY);
}

export function buildCapabilitySummaryForUser(): string {
  const toolCount = listUltimateToolNames().length;
  return (
    `أقدر أنفّذ لك (${toolCount} أداة + 16 أمر):\n` +
    `• مفاتيح API، إحصائيات، كاش، نسخ احتياطي/استعادة، evolve\n` +
    `• SEO، سرعة، إيرادات، أهداف، صحة النظام والمحتوى\n` +
    `• عملاء/leads، واتساب dossier، منتجات، بحث ويب\n` +
    `• وكلاء سحابة للمهام الكبيرة + Genesis\n` +
    `• SEO: DB + تعديل app/layout.tsx عبر PR | استعادة عملاء (merge)\n` +
    `• project_evolve: PR متعدد الملفات | evolve سحابي | نشر Vercel\n` +
    `• واتساب dossier تلقائي | «تذكّر» | «تقرير يومي»\n\n` +
    `الحساس يمر بموافقتك — لكنه قدرة كاملة وليس «قريباً».`
  );
}
