import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCurrentTenant } from "@/lib/tenant";

export async function GET() {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json(
        { ok: false, message: "Tenant not configured" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();

    const { data: pages, error } = await supabase
      .from("pages")
      .select("id, slug, title, status, created_at")
      .eq("company_id", tenant.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Pages fetch error:", error);
      return NextResponse.json(
        { ok: false, message: "Failed to fetch pages" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      pages: pages || [],
    });
  } catch (error) {
    console.error("Pages API error:", error);
    return NextResponse.json(
      { ok: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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

    const { data: page, error } = await supabase
      .from("pages")
      .insert({
        company_id: tenant.id,
        slug: body.slug,
        title: body.title,
        status: body.status || "draft",
        seo_title: body.seo_title,
        seo_description: body.seo_description,
        og_image: body.og_image,
      })
      .select("id, slug, title, status, created_at")
      .single();

    if (error) {
      console.error("Page creation error:", error);
      return NextResponse.json(
        { ok: false, message: "Failed to create page" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      page,
    });
  } catch (error) {
    console.error("Pages POST error:", error);
    return NextResponse.json(
      { ok: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}