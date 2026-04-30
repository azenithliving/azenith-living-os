import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCurrentTenant } from "@/lib/tenant";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json(
        { ok: false, message: "Tenant not configured" },
        { status: 400 }
      );
    }

    const { id } = await params;
    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new Error('Supabase not initialized');

    const { data: page, error } = await supabase
      .from("pages")
      .select("*")
      .eq("id", id)
      .eq("company_id", tenant.id)
      .single();

    if (error) {
      console.error("Page fetch error:", error);
      return NextResponse.json(
        { ok: false, message: "Failed to fetch page" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      page,
    });
  } catch (error) {
    console.error("Page API error:", error);
    return NextResponse.json(
      { ok: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json(
        { ok: false, message: "Tenant not configured" },
        { status: 400 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new Error('Supabase not initialized');

    const { error } = await supabase
      .from("pages")
      .update({
        title: body.title,
        slug: body.slug,
        status: body.status,
        seo_title: body.seo_title,
        seo_description: body.seo_description,
        og_image: body.og_image,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("company_id", tenant.id);

    if (error) {
      console.error("Page update error:", error);
      return NextResponse.json(
        { ok: false, message: "Failed to update page" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Page updated successfully",
    });
  } catch (error) {
    console.error("Page update API error:", error);
    return NextResponse.json(
      { ok: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}