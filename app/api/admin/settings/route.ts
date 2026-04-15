/**
 * Site Settings Management API
 * Key-value store for site configuration (SEO, Theme, CMS settings)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

interface SiteSetting {
  key: string;
  value: unknown;
  updated_at?: string;
  updated_by?: string | null;
}

/**
 * GET /api/admin/settings
 * Get all settings or a specific setting by key
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    const supabase = await createClient();

    if (key) {
      // Get specific setting
      const { data, error } = await supabase
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

      return NextResponse.json({ success: true, setting: data as SiteSetting });
    } else {
      // Get all settings
      const { data, error } = await supabase
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
      (data as SiteSetting[]).forEach((item) => {
        settings[item.key] = item.value;
      });

      return NextResponse.json({ success: true, settings, raw: data });
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
    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: key and value are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get current user for updated_by
    const { data: { user } } = await supabase.auth.getUser();

    // Upsert (insert or update)
    const { data, error } = await supabase
      .from("site_settings")
      .upsert(
        {
          key,
          value,
          updated_by: user?.id || null,
        },
        { onConflict: "key" }
      )
      .select()
      .single();

    if (error) {
      console.error("[Settings API] Error saving setting:", error);
      return NextResponse.json(
        { success: false, error: "Failed to save setting" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      setting: data as SiteSetting,
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
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json(
        { success: false, error: "Missing key parameter" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { error } = await supabase
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
