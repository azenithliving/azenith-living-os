/**
 * Telegram Configuration API
 * Manages bot token, chat IDs, and enabled state in site_settings table.
 *
 * Stored under key: "telegram_config"
 * Value shape:
 * {
 *   botToken: string;
 *   enabled: boolean;
 *   chats: Array<{ id: string; label: string; chatId: string; isDefault: boolean }>;
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase-service";
import { clearTelegramConfigCache } from "@/lib/telegram-config";

export const dynamic = "force-dynamic";

const SETTINGS_KEY = "telegram_config";

export interface TelegramChatEntry {
  id: string;       // internal UUID for list management
  label: string;    // friendly name, e.g. "Admin Group"
  chatId: string;   // Telegram chat_id (numeric string)
  isDefault: boolean;
}

export interface TelegramConfig {
  botToken: string;
  enabled: boolean;
  chats: TelegramChatEntry[];
}

function buildDefaultConfig(): TelegramConfig {
  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN || "",
    enabled: process.env.TELEGRAM_ENABLED === "true",
    chats: process.env.TELEGRAM_CHAT_ID
      ? [
          {
            id: "default",
            label: "القناة الافتراضية",
            chatId: process.env.TELEGRAM_CHAT_ID,
            isDefault: true,
          },
        ]
      : [],
  };
}

/**
 * GET /api/admin/telegram/config
 * Returns current Telegram config (token masked).
 */
export async function GET() {
  try {
    const { data, error } = await supabaseService
      .from("site_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle() as { data: { value: unknown } | null; error: any };

    if (error) throw error;

    const config: TelegramConfig = (data?.value as TelegramConfig) ?? buildDefaultConfig();

    // Mask token for client — only send last 6 chars
    const masked: TelegramConfig & { tokenMasked: string; hasToken: boolean } = {
      ...config,
      botToken: "",           // never send raw token to client
      tokenMasked: config.botToken
        ? `••••••${config.botToken.slice(-6)}`
        : "",
      hasToken: Boolean(config.botToken),
    };

    return NextResponse.json({ success: true, config: masked });
  } catch (err: any) {
    console.error("[Telegram Config] GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/telegram/config
 * Full save — replaces entire config.
 * Body: { botToken?: string; enabled: boolean; chats: TelegramChatEntry[] }
 * If botToken is omitted or empty, keeps existing value.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Load existing to merge token if not provided
    const { data: existing } = await supabaseService
      .from("site_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle() as { data: { value: unknown } | null; error: any };

    const current: TelegramConfig =
      (existing?.value as TelegramConfig) ?? buildDefaultConfig();

    // Only update token if a non-empty value was sent
    const newToken: string =
      typeof body.botToken === "string" && body.botToken.trim()
        ? body.botToken.trim()
        : current.botToken;

    const newConfig: TelegramConfig = {
      botToken: newToken,
      enabled: Boolean(body.enabled),
      chats: Array.isArray(body.chats) ? body.chats : current.chats,
    };

    const { error } = await supabaseService
      .from("site_settings")
      .upsert({ key: SETTINGS_KEY, value: newConfig } as any, { onConflict: "key" });

    if (error) throw error;
    clearTelegramConfigCache();

    return NextResponse.json({
      success: true,
      message: "تم حفظ إعدادات تليجرام",
      hasToken: Boolean(newConfig.botToken),
      enabled: newConfig.enabled,
      chatsCount: newConfig.chats.length,
    });
  } catch (err: any) {
    console.error("[Telegram Config] POST error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/telegram/config
 * Partial update — only updates the specified fields.
 * Useful for toggling enabled without resending the token.
 * Body: { enabled?: boolean; chats?: TelegramChatEntry[] }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const { data: existing } = await supabaseService
      .from("site_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle() as { data: { value: unknown } | null; error: any };

    const current: TelegramConfig =
      (existing?.value as TelegramConfig) ?? buildDefaultConfig();

    const patched: TelegramConfig = {
      botToken: current.botToken,
      enabled: "enabled" in body ? Boolean(body.enabled) : current.enabled,
      chats: Array.isArray(body.chats) ? body.chats : current.chats,
    };

    const { error } = await supabaseService
      .from("site_settings")
      .upsert({ key: SETTINGS_KEY, value: patched } as any, { onConflict: "key" });

    if (error) throw error;
    clearTelegramConfigCache();
    return NextResponse.json({
      success: true,
      message: "تم تحديث الإعدادات",
      enabled: patched.enabled,
      chatsCount: patched.chats.length,
    });
  } catch (err: any) {
    console.error("[Telegram Config] PATCH error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/telegram/config
 * Resets Telegram config to defaults (clears DB entry).
 */
export async function DELETE() {
  try {
    const { error } = await supabaseService
      .from("site_settings")
      .delete()
      .eq("key", SETTINGS_KEY);

    if (error) throw error;
    clearTelegramConfigCache();
    return NextResponse.json({ success: true, message: "تم حذف إعدادات تليجرام" });
  } catch (err: any) {
    console.error("[Telegram Config] DELETE error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
