/**
 * External Integrations for Ultimate Agent
 * WhatsApp/Telegram incoming message parser
 * Mobile command handling
 */

import { processCommand } from "./ultimate-agent/agent-core";

export async function parseIncomingWhatsApp(message: string, from: string): Promise<string> {
  try {
    const result = await processCommand(message, from);
    return result.message || "تم معالجة الأمر";
  } catch (e) {
    return `خطأ في معالجة الرسالة: ${e}`;
  }
}

export async function parseTelegramMessage(message: string, userId: string): Promise<string> {
  return parseIncomingWhatsApp(message, userId);
}

// Hook for cron or webhook
export function setupIncomingHandlers() {
  // Vercel API route or webhook
  console.log("External handlers ready (WhatsApp/Telegram)");
}

// Example webhook
export async function whatsappWebhook(body: {
  message?: {
    text?: string;
    from?: string;
  };
}): Promise<{ reply: string }> {
  const message = body.message?.text || '';
  const from = body.message?.from || 'unknown';
  const reply = await parseIncomingWhatsApp(message, from);
  return { reply };
}

