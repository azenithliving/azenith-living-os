/**
 * Site Settings Management API
 * Key-value store for site configuration (SEO, Theme, CMS settings)
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseService } from "@/lib/supabase-service";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { SECRET_MASK } from "@/lib/settings/facts";

export const dynamic = "force-dynamic";

/** Keys whose value carries a credential. The browser never sees the value. */
const SECRET_KEYS = new Set(["telegram_config"]);

function maskSecret(setting: SiteSetting): SiteSetting {
  if (!SECRET_KEYS.has(setting.key) || typeof setting.value !== "object" || setting.value === null) {
    return setting;
  }
  const value = setting.value as Record<string, unknown>;
  const cleaned: Record<string, unknown> = { ...value };
  for (const field of ["botToken", "token", "secret", "password"]) {
    if (cleaned[field]) cleaned[field] = SECRET_MASK;
  }
  return { ...setting, value: cleaned };
}

function carriesMask(value: unknown): boolean {
  return JSON.stringify(value ?? "").includes(SECRET_MASK);
}

interface SiteSetting {
  key: string;
  value: unknown;
  updated_at?: string;
  updated_by?: string | null;
}

function isUuid(value: string | null): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
      )
  );
}

function isMissingColumn(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    /column .* does not exist|could not find .* column/i.test(error?.message || "")
  );
}

/**
 * GET /api/admin/settings
 * Get all settings or a specific setting by key
 */
export async function GET(request: NextRequest) {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (key) {
      // Get specific setting
      const { data, error } = await supabaseService
        .from("site_settings")
        .select("*")
        .eq("key", key)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // Not found
          return NextResponse.json(
            { success: false, error: "Setting not found" },
            { status: 404 }
          );
        }
        console.error("[Settings API] Error fetching setting:", error);
        return NextResponse.json(
          { success: false, error: "Failed to fetch setting", details: error },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, setting: maskSecret(data as SiteSetting) });
    } else {
      // Get all settings
      const { data, error } = await supabaseService
        .from("site_settings")
        .select("*")
        .order("key", { ascending: true });

      if (error) {
        console.error("[Settings API] Error fetching settings:", error);
        return NextResponse.json(
          { success: false, error: "Failed to fetch settings", details: error },
          { status: 500 }
        );
      }

      // Convert to key-value object for easier frontend use
      const settings: Record<string, unknown> = {};
      const rawMasked = (data as SiteSetting[]).map(maskSecret);
      rawMasked.forEach((item) => {
        settings[item.key] = item.value;
      });

      return NextResponse.json({ success: true, settings, raw: rawMasked });
    }
  } catch (error) {
    console.error("[Settings API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/settings
 * Create or update a setting: { key: string, value: any }
 */
export async function POST(request: NextRequest) {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: key and value are required" },
        { status: 400 }
      );
    }

    // The desk is handed a mask instead of a credential, so a save that carries the mask back would
    // overwrite the real key with a sentence. Refuse it, and say what to do instead.
    if (carriesMask(value)) {
      return NextResponse.json(
        { success: false, error: "مفيش مفتاح بيتكتب على الشاشة — غيّر من لوحته الخاص" },
        { status: 400 }
      );
    }

    // Upsert (insert or update)
    const payload: Record<string, unknown> = {
      key,
      value,
    };

    let { data, error } = await supabaseService
      .from("site_settings")
      .upsert(payload as never, { onConflict: "key" })
      .select()
      .single();

    if (error && isMissingColumn(error) && "updated_by" in payload) {
      delete payload.updated_by;
      const legacyResult = await supabaseService
        .from("site_settings")
        .upsert(payload as never, { onConflict: "key" })
        .select()
        .single();
      data = legacyResult.data;
      error = legacyResult.error;
    }

    if (error) {
      console.error("[Settings API] Error saving setting:", error);
      return NextResponse.json(
        { success: false, error: "Failed to save setting" },
        { status: 500 }
      );
    }

    // `seo` and `theme` are read while rendering the site shell, and the
    // storefront pages are cached — without this, turning ads on would look like
    // it did nothing until the cache happened to expire.
    if (key === "seo" || key === "theme") {
      try {
        revalidatePath("/", "layout");
      } catch {
        /* revalidating must never fail a saved setting */
      }
    }

    return NextResponse.json({
      success: true,
      setting: data as unknown as SiteSetting,
      message: "Setting saved successfully",
    });
  } catch (error) {
    console.error("[Settings API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/settings?key=<key>
 * Delete a setting
 */
export async function DELETE(request: NextRequest) {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json(
        { success: false, error: "Missing key parameter" },
        { status: 400 }
      );
    }

    const { error } = await supabaseService
      .from("site_settings")
      .delete()
      .eq("key", key);

    if (error) {
      console.error("[Settings API] Error deleting setting:", error);
      return NextResponse.json(
        { success: false, error: "Failed to delete setting" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Setting deleted successfully",
    });
  } catch (error) {
    console.error("[Settings API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
