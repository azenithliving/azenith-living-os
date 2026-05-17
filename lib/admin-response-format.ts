/**
 * Human-readable replies when LLM is unavailable but commands/tools succeeded.
 */

import type { CommandResult } from "./command-executor";

export function isGenericAiFailureMessage(text: string): boolean {
  const t = text.trim();
  return (
    !t ||
    t.includes("مشكلة تقنية") ||
    t.includes("technical issue") ||
    t.includes("Try again") ||
    t.includes("جرب مرة أخرى")
  );
}

export function formatCommandResultForUser(
  result: CommandResult,
  commandName?: string
): string {
  if (!result.success) {
    return result.message || "لم أنفّذ الطلب — حصل خطأ.";
  }

  const cmd = (commandName || "").toLowerCase();
  const data = result.data as Record<string, unknown> | undefined;

  if (cmd === "list_keys" && data && Array.isArray(data.keys)) {
    const keys = data.keys as Array<{
      provider?: string;
      status?: string;
      totalRequests?: number;
    }>;
    const total = (data.total as number) ?? keys.length;
    if (total === 0) {
      return "مفيش مفاتيح API نشطة في قاعدة البيانات حالياً. تقدر تضيف مفتاح بـ «أضف مفتاح groq …».";
    }
    const byProvider: Record<string, number> = {};
    for (const k of keys) {
      const p = k.provider || "unknown";
      byProvider[p] = (byProvider[p] || 0) + 1;
    }
    const lines = Object.entries(byProvider)
      .map(([p, n]) => `• ${p}: ${n} مفتاح`)
      .join("\n");
    return `عندك ${total} مفتاح نشط:\n${lines}\n\n${result.message || ""}`.trim();
  }

  if (cmd === "check_keys" && data) {
    return result.message || "تم فحص المفاتيح.";
  }

  if (result.message) return result.message;
  return "تم التنفيذ بنجاح.";
}
