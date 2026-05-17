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
  const tools = listUltimateToolNames().slice(0, 12).join("، ");
  return (
    `أقدر أنفّذ لك:\n` +
    `• أوامر الإدارة: مفاتيح API، إحصائيات، كاش، نسخ احتياطي، evolve\n` +
    `• أدوات Ultimate: ${tools}…\n` +
    `• تحليلات وزوار، صحة النظام، إعدادات وأتمتة\n` +
    `• مهام كبيرة عبر الوكلاء السحابيين (تحليل + تنفيذ + أمن)\n` +
    `• Genesis للتكوين المعماري\n\n` +
    `لو طلبك جديد، هوجّهه لأقرب محرك وأنفّذه أو أشرح لك الخطوة التالية.`
  );
}
