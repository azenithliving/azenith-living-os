import { sendTelegramMessage, getActiveTelegramConfig } from "@/lib/telegram-config";

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
  const cfg = await getActiveTelegramConfig();

  if (!cfg.botToken || !cfg.chatId) {
    return {
      success: false,
      configured: false,
      message: "Telegram is not configured.",
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

  const ok = await sendTelegramMessage(text, {
    silent: reason !== "critical_alert",
  });

  return {
    success: ok,
    configured: true,
    message: ok ? "Telegram summon sent" : "Telegram summon failed",
  };
}

function escapeTelegramHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
