import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCurrentTenant } from "@/lib/tenant";

type ThemeSettings = {
  primaryColor: string;
  secondaryColor: string;
  headingFont: string;
  bodyFont: string;
};

export async function GET() {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json(
        { ok: false, message: "Tenant not configured" },
        { status: 400 }
      );
    }

    // For now, return default settings based on tenant data
    // In a full implementation, this would fetch from a theme_settings table
    const settings: ThemeSettings = {
      primaryColor: tenant.primary_color || "#c9a96e",
      secondaryColor: "#1a1a1a",
      headingFont: "serif",
      bodyFont: "sans",
    };

    return NextResponse.json({
      ok: true,
      settings,
    });
  } catch (error) {
    console.error("Theme GET error:", error);
    return NextResponse.json(
      { ok: false, message: "Failed to fetch theme settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json(
        { ok: false, message: "Tenant not configured" },
        { status: 400 }
      );
    }

    const body: ThemeSettings = await request.json();
    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new Error('Supabase not initialized');

    // Update the primary color in companies table
    // In a full implementation, this would update a theme_settings table
    const { error } = await supabase
      .from("companies")
      .update({
        primary_color: body.primaryColor,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenant.id);

    if (error) {
      console.error("Theme update error:", error);
      return NextResponse.json(
        { ok: false, message: "Failed to update theme settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Theme settings updated successfully",
    });
  } catch (error) {
    console.error("Theme PATCH error:", error);
    return NextResponse.json(
      { ok: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}