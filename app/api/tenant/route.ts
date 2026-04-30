import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCurrentTenant } from "@/lib/tenant";

export async function GET() {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json(
        { ok: false, message: "Tenant not configured" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      tenant,
    });
  } catch (error) {
    console.error("Tenant GET error:", error);
    return NextResponse.json(
      { ok: false, message: "Internal server error" },
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

    const body = await request.json();
    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new Error('Supabase not initialized');

    // Update tenant
    const { error } = await supabase
      .from("companies")
      .update({
        name: body.name,
        logo: body.logo || null,
        primary_color: body.primary_color,
        whatsapp: body.whatsapp || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenant.id);

    if (error) {
      console.error("Tenant update error:", error);
      return NextResponse.json(
        { ok: false, message: "Failed to update tenant" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Tenant updated successfully",
    });
  } catch (error) {
    console.error("Tenant API error:", error);
    return NextResponse.json(
      { ok: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}