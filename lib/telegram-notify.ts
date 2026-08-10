/**
 * Telegram Security Notifications
 * Sends instant alerts for security events
 */

import { sendTelegramMessage, getActiveTelegramConfig } from "@/lib/telegram-config";

interface SecurityEvent {
  type: "login" | "2fa" | "command" | "signature" | "alert" | "warning" | "critical";
  message: string;
  user?: string;
  ip?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

/**
 * Send a security alert via Telegram
 */
export async function sendSecurityAlert(message: string): Promise<boolean> {
  const cfg = await getActiveTelegramConfig();
  if (!cfg.enabled || !cfg.botToken || !cfg.chatId) {
    console.log("[TELEGRAM ALERT - Simulated]", message);
    return true;
  }
  return sendTelegramMessage(message, { silent: false });
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

  const formattedMessage = `
${icons[event.type] || "📢"} <b>SOVEREIGN SECURITY EVENT</b>

<b>Type:</b> ${event.type.toUpperCase()}
<b>Time:</b> ${event.timestamp}
${event.user ? `<b>User:</b> ${event.user}\n` : ""}
${event.ip ? `<b>IP:</b> ${event.ip}\n` : ""}
<b>Message:</b>
${event.message}
  `.trim();

  return sendSecurityAlert(formattedMessage);
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
      `🚨 MULTIPLE FAILED LOGIN ATTEMPTS\n` +
      `Email: ${email}\n` +
      `Attempts: ${attemptCount}\n` +
      `IP: ${ip}\n` +
      `Time: ${new Date().toISOString()}\n\n` +
      `⚠️ Possible brute force attack!`
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
    `💥 INVALID SIGNATURE ATTEMPT\n` +
    `User: ${user}\n` +
    `Command: ${command}\n` +
    `IP: ${ip}\n` +
    `Time: ${new Date().toISOString()}\n\n` +
    `🚨 Possible tampering attempt!`
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
      `⚠️ DANGEROUS COMMAND EXECUTED\n` +
      `User: ${user}\n` +
      `Command: ${command}\n` +
      `Result: ${result}\n` +
      `Time: ${new Date().toISOString()}\n\n` +
      `🔥 High risk operation performed!`
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
