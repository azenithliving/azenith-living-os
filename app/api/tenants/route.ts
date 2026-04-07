import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type TenantPayload = {
  name: string;
  domain: string;
  logo?: string;
  primary_color?: string;
  whatsapp?: string;
};

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    const { data: tenants, error } = await supabase
      .from("companies")
      .select("id, name, domain, logo, primary_color, whatsapp, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Tenant list error:", error);
      return NextResponse.json({ ok: false, message: "Failed to fetch tenants" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, tenants: tenants ?? [] });
  } catch (error) {
    console.error("Tenant list exception:", error);
    return NextResponse.json({ ok: false, message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body: TenantPayload = await request.json();
    const supabase = getSupabaseAdminClient();

    if (!body.name || !body.domain) {
      return NextResponse.json({ ok: false, message: "Name and domain are required" }, { status: 400 });
    }

    const normalizedDomain = body.domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split(":")[0].trim().toLowerCase();

    const existing = await supabase
      .from("companies")
      .select("id")
      .eq("domain", normalizedDomain)
      .maybeSingle();

    if (existing.error) {
      console.error("Tenant lookup error:", existing.error);
      return NextResponse.json({ ok: false, message: "Failed to validate tenant domain" }, { status: 500 });
    }

    if (existing.data) {
      return NextResponse.json({ ok: false, message: "Domain already in use" }, { status: 409 });
    }

    const { data: tenant, error } = await supabase
      .from("companies")
      .insert({
        name: body.name,
        domain: normalizedDomain,
        logo: body.logo || null,
        primary_color: body.primary_color || "#C5A059",
        whatsapp: body.whatsapp || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id, name, domain, logo, primary_color, whatsapp, created_at")
      .single();

    if (error) {
      console.error("Tenant create error:", error);
      return NextResponse.json({ ok: false, message: "Failed to create tenant" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, tenant });
  } catch (error) {
    console.error("Tenant create exception:", error);
    return NextResponse.json({ ok: false, message: "Internal server error" }, { status: 500 });
  }
}
