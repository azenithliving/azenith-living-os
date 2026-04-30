/**
 * Telegram Security Notifications
 * Sends instant alerts for security events
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const TELEGRAM_ENABLED = process.env.TELEGRAM_ENABLED === "true";

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
  // إذا كان Telegram غير مفعل، نكتب في السجل فقط
  if (!TELEGRAM_ENABLED || !TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log("[TELEGRAM ALERT - Simulated]", message);
    return true;
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
        disable_notification: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Telegram notification failed:", errorData);
      return false;
    }

    console.log("[TELEGRAM ALERT SENT]");
    return true;

  } catch (error) {
    console.error("Telegram notification error:", error);
    // لا نريد فشل العملية بسبب عدم إرسال الإشعار
    return false;
  }
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
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log("Telegram not configured - Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID");
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`;
    const response = await fetch(url);
    
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
