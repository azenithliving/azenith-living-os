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

    const { data: assets, error } = await supabase
      .from("images")
      .select("id, url, tags, source, license, ctr, conversions")
      .eq("company_id", tenant.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Media fetch error:", error);
      return NextResponse.json(
        { ok: false, message: "Failed to fetch media assets" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      assets: assets || [],
    });
  } catch (error) {
    console.error("Media API error:", error);
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

    const { data: asset, error } = await supabase
      .from("images")
      .insert({
        company_id: tenant.id,
        url: body.url,
        tags: body.tags || [],
        source: body.source,
        license: body.license,
      })
      .select("id, url, tags, source, license, ctr, conversions")
      .single();

    if (error) {
      console.error("Media creation error:", error);
      return NextResponse.json(
        { ok: false, message: "Failed to add media asset" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      asset,
    });
  } catch (error) {
    console.error("Media POST error:", error);
    return NextResponse.json(
      { ok: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}