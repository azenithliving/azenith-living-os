/**
 * External Integrations for Ultimate Agent
 * Telegram incoming message parser / mobile command handling
 */

import { processCommand } from "./ultimate-agent/agent-core";

export async function parseTelegramMessage(
  message: string,
  userId: string
): Promise<string> {
  try {
    const result = await processCommand(message, userId);
    return result.message || "تم معالجة الأمر";
  } catch (e) {
    return `خطأ في معالجة الرسالة: ${e}`;
  }
}

// Hook for cron or webhook
export function setupIncomingHandlers() {
  console.log("External handlers ready (Telegram)");
}

// Telegram webhook handler
export async function telegramWebhook(body: {
  message?: {
    text?: string;
    from?: { id?: number | string };
  };
}): Promise<{ reply: string }> {
  const message = body.message?.text || "";
  const from = String(body.message?.from?.id || "unknown");
  const reply = await parseTelegramMessage(message, from);
  return { reply };
}
