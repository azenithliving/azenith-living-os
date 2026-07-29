export type AdminSummonReason =
  | "needs_owner"
  | "approval_required"
  | "critical_alert"
  | "human_step"
  | "general";

export async function sendAdminTelegramSummon(params: {
  title: string;
  message: string;
  reason?: AdminSummonReason;
  href?: string;
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return {
      success: false,
      configured: false,
      message: "Telegram is not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.",
    };
  }

  const appUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const href = params.href || "/admin";
  const url = href.startsWith("http") ? href : `${appUrl.replace(/\/$/, "")}${href}`;
  const reason = params.reason || "general";

  const text = [
    "<b>استدعاء من المساعد الموحد</b>",
    `<b>السبب:</b> ${reason}`,
    `<b>العنوان:</b> ${escapeTelegramHtml(params.title)}`,
    "",
    escapeTelegramHtml(params.message),
    "",
    `<a href="${escapeTelegramHtml(url)}">افتح لوحة الأدمن</a>`,
  ].join("\n");

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      disable_notification: reason !== "critical_alert",
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    description?: string;
  };

  return {
    success: response.ok && payload.ok !== false,
    configured: true,
    message: payload.description || (response.ok ? "Telegram summon sent" : "Telegram summon failed"),
  };
}

function escapeTelegramHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
