/**
 * Telegram Security Notifications
 * Sends instant alerts for security events
 */

import { broadcastTelegramMessage, getActiveTelegramConfig } from "@/lib/telegram-config";
import { telegramAlert, telegramTime } from "@/lib/telegram-copy";

interface SecurityEvent {
  type: "login" | "2fa" | "command" | "signature" | "alert" | "warning" | "critical";
  message: string;
  user?: string;
  ip?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

const EVENT_TITLES: Record<SecurityEvent["type"], string> = {
  login: "دخول",
  "2fa": "التحقق بخطوتين",
  command: "أمر إداري",
  signature: "توقيع مرفوض",
  alert: "تنبيه",
  warning: "تحذير",
  critical: "خطر",
};

/**
 * Send a security alert via Telegram
 *
 * Every admin chat he seated, not the first one — measured 2026-10-06: the login alert arrived on
 * one of his two numbers and he had no way to know the other never saw it. And when no channel is
 * configured, nothing was said: answering `true` there tells the caller he warned the owner, and he
 * did not.
 */
export async function sendSecurityAlert(message: string): Promise<boolean> {
  const cfg = await getActiveTelegramConfig();
  if (!cfg.enabled || !cfg.botToken) {
    console.log("[Telegram] no channel configured — the security notice was not sent:", message.slice(0, 80));
    return false;
  }
  return (await broadcastTelegramMessage(message, { silent: false })) > 0;
}

/**
 * Send formatted security event
 */
export async function sendSecurityEvent(event: SecurityEvent): Promise<boolean> {
  const icons: Record<string, string> = {
    login: "🔓",
    "2fa": "🔐",
    command: "⚡",
    signature: "✍️",
    alert: "⚠️",
    warning: "🚨",
    critical: "💥",
  };

  return sendSecurityAlert(
    telegramAlert(
      icons[event.type] ?? "📢",
      `أمن المتجر — ${EVENT_TITLES[event.type] ?? "تنبيه"}`,
      [
        ["الوقت", telegramTime(event.timestamp)],
        ["المستخدم", event.user],
        ["العنوان", event.ip],
        ["التفاصيل", event.message],
      ]
    )
  );
}

/**
 * Notify on failed login attempt (5+ attempts)
 */
export async function notifyFailedLogin(
  email: string,
  ip: string,
  attemptCount: number
): Promise<void> {
  if (attemptCount >= 5) {
    await sendSecurityAlert(
      telegramAlert(
        "🚨",
        "محاولات دخول فاشلة وراها بعض",
        [
          ["البريد", email],
          ["عدد المحاولات", attemptCount],
          ["العنوان", ip],
          ["الوقت", telegramTime()],
        ],
        "ممكن يكون حد بيجرّب يفتح الدار — راجع اللوحة."
      )
    );
  }
}

/**
 * Notify on invalid signature attempt
 */
export async function notifyInvalidSignature(
  user: string,
  command: string,
  ip: string
): Promise<void> {
  await sendSecurityAlert(
    telegramAlert(
      "💥",
      "محاولة توقيع غلط",
      [
        ["المستخدم", user],
        ["الأمر", command],
        ["العنوان", ip],
        ["الوقت", telegramTime()],
      ],
      "في حد حاول يغيّر حاجة والتوقيع ما طابقش."
    )
  );
}

/**
 * Notify on dangerous command execution
 */
export async function notifyDangerousCommand(
  user: string,
  command: string,
  result: string
): Promise<void> {
  const dangerousCommands = ["delete", "drop", "truncate", "remove", "purge", "wipe"];
  const isDangerous = dangerousCommands.some(cmd => 
    command.toLowerCase().includes(cmd)
  );

  if (isDangerous) {
    await sendSecurityAlert(
      telegramAlert(
        "⚠️",
        "أمر خطر اتنفّذ",
        [
          ["المستخدم", user],
          ["الأمر", command],
          ["النتيجة", result],
          ["الوقت", telegramTime()],
        ],
        "ده عملية تمسح بيانات — تأكد إنها كانت مقصودة."
      )
    );
  }
}

/**
 * Test Telegram configuration
 */
export async function testTelegramConfig(): Promise<boolean> {
  const cfg = await getActiveTelegramConfig();
  if (!cfg.botToken) {
    console.log("Telegram not configured");
    return false;
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${cfg.botToken}/getMe`);
    if (response.ok) {
      const data = await response.json();
      console.log("Telegram bot connected:", data.result?.username);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Telegram test failed:", error);
    return false;
  }
}
