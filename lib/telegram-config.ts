/**
 * Telegram Configuration Resolver
 * الأولوية: قاعدة البيانات (الـ Panel) ← متغيرات البيئة (env)
 *
 * كل الكود بيستخدم getActiveTelegramConfig() بدل process.env مباشرة
 * عشان التغييرات اللي بتتعمل من الـ Panel تأثر فعلاً على الإرسال
 */

import "server-only";

export interface TelegramChatEntry {
  id: string;
  label: string;
  chatId: string;
  isDefault: boolean;
}

export interface ActiveTelegramConfig {
  botToken: string;
  chatId: string;           // الـ Chat ID الافتراضي (لإرسال الإشعارات)
  allChats: TelegramChatEntry[];
  enabled: boolean;
}

let _cache: ActiveTelegramConfig | null = null;
let _cacheAt = 0;
const CACHE_TTL_MS = 30_000; // 30 ثانية cache

/** قرأ الإعدادات من DB مع fallback للـ env */
async function loadFromDB(): Promise<ActiveTelegramConfig | null> {
  try {
    // dynamic import عشان نتجنب circular deps
    const { supabaseService } = await import("@/lib/supabase-service");
    const { data } = await (supabaseService
      .from("site_settings")
      .select("value")
      .eq("key", "telegram_config")
      .maybeSingle() as unknown as Promise<{ data: { value: unknown } | null; error: unknown }>);

    if (!data?.value) return null;

    const cfg = data.value as {
      botToken?: string;
      enabled?: boolean;
      chats?: TelegramChatEntry[];
    };

    if (!cfg.botToken) return null;

    const chats: TelegramChatEntry[] = Array.isArray(cfg.chats) ? cfg.chats : [];
    const defaultChat = chats.find((c) => c.isDefault) ?? chats[0];

    return {
      botToken: cfg.botToken,
      chatId: defaultChat?.chatId ?? "",
      allChats: chats,
      enabled: cfg.enabled !== false,
    };
  } catch {
    return null;
  }
}

/** الإعدادات من env كـ fallback */
function fromEnv(): ActiveTelegramConfig {
  const chatIdEnv = process.env.TELEGRAM_CHAT_ID ?? "";
  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
    chatId: chatIdEnv,
    allChats: chatIdEnv
      ? [{ id: "env", label: "الافتراضي (env)", chatId: chatIdEnv, isDefault: true }]
      : [],
    enabled: process.env.TELEGRAM_ENABLED === "true",
  };
}

/**
 * الدالة الرئيسية — استخدمها في أي مكان بدل process.env
 * بترجع الـ botToken والـ chatId الصحيحين (من DB أو env)
 */
export async function getActiveTelegramConfig(): Promise<ActiveTelegramConfig> {
  const now = Date.now();

  // استخدم الـ cache لو لسه fresh
  if (_cache && now - _cacheAt < CACHE_TTL_MS) {
    return _cache;
  }

  const dbConfig = await loadFromDB();
  const result = dbConfig ?? fromEnv();

  _cache = result;
  _cacheAt = now;
  return result;
}

/** امسح الـ cache لما الـ Panel يحفظ إعدادات جديدة */
export function clearTelegramConfigCache() {
  _cache = null;
  _cacheAt = 0;
}

/**
 * بعت للحساب الافتراضي فقط — للإشعارات الحساسة (أمان، تسجيل دخول، إلخ)
 */
export async function sendTelegramMessage(
  text: string,
  options?: {
    chatId?: string;
    silent?: boolean;
  }
): Promise<boolean> {
  const cfg = await getActiveTelegramConfig();

  if (!cfg.botToken) {
    console.log("[Telegram] Bot token not configured — message logged:", text.slice(0, 80));
    return false;
  }

  if (!cfg.enabled) {
    console.log("[Telegram] Disabled — message logged:", text.slice(0, 80));
    return false;
  }

  const targetChatId = options?.chatId ?? cfg.chatId;
  if (!targetChatId) {
    console.log("[Telegram] No chat ID configured — message logged:", text.slice(0, 80));
    return false;
  }

  return _sendOne(cfg.botToken, targetChatId, text, options?.silent ?? false);
}

/**
 * بعت لكل الحسابات المضافة — للإشعارات العامة (مستشار، مبيعات، عملاء)
 */
export async function broadcastTelegramMessage(
  text: string,
  options?: { silent?: boolean }
): Promise<void> {
  const cfg = await getActiveTelegramConfig();
  if (!cfg.botToken || !cfg.enabled) return;

  const chats = cfg.allChats.length > 0
    ? cfg.allChats
    : cfg.chatId ? [{ id: "default", chatId: cfg.chatId, label: "", isDefault: true }] : [];

  for (const chat of chats) {
    await _sendOne(cfg.botToken, chat.chatId, text, options?.silent ?? false).catch(() => {});
  }
}

async function _sendOne(token: string, chatId: string, text: string, silent: boolean): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_notification: silent,
          disable_web_page_preview: true,
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[Telegram] Send failed to", chatId, ":", err);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[Telegram] Send error:", err);
    return false;
  }
}
