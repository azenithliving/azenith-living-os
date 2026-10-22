import { NextResponse } from "next/server";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireAdminApi } from "@/lib/admin-api-guard";

type TenantPayload = {
  name: string;
  domain: string;
  logo?: string;
  primary_color?: string;
  whatsapp?: string;
};

/**
 * The tenant console is infrastructure, not a sales desk drawer: the advisor door and the leads
 * pipeline resolve which company a visitor belongs to from this table. Measured 2026-10-23 on the
 * published link (`scratch/prove-tenants-door.mjs`), both verbs answered a stranger with no session:
 * GET returned the company's name and WhatsApp number, and POST created a row (deleted again by the
 * probe). Every verb here asks the admin gate now.
 */
export async function GET() {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new Error("Supabase not initialized");
    const { data: tenants, error } = await supabase
      .from("companies")
      .select("id, name, domain, logo, primary_color, whatsapp, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Tenant list error:", error);
      return NextResponse.json({ ok: false, message: "قائمة الشركات ما قريتش من القاعدة" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, tenants: tenants ?? [] });
  } catch (error) {
    console.error("Tenant list exception:", error);
    return NextResponse.json({ ok: false, message: "القراءة وقفت — السبب اتسجل في اللوج" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const body: TenantPayload = await request.json();
    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new Error("Supabase not initialized");

    if (!body.name || !body.domain) {
      return NextResponse.json({ ok: false, message: "اسم الشركة وعنوانها مطلوبين" }, { status: 400 });
    }

    const normalizedDomain = body.domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split(":")[0].trim().toLowerCase();

    const existing = await supabase
      .from("companies")
      .select("id")
      .eq("domain", normalizedDomain)
      .maybeSingle();

    if (existing.error) {
      console.error("Tenant lookup error:", existing.error);
      return NextResponse.json({ ok: false, message: "عنوان الشركة ما اتأكدش منه" }, { status: 500 });
    }

    if (existing.data) {
      return NextResponse.json({ ok: false, message: "العنوان ده مستخدم قبل كده" }, { status: 409 });
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
      return NextResponse.json({ ok: false, message: "الشركة ما اتعملتش — السبب اتسجل في اللوج" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, tenant });
  } catch (error) {
    console.error("Tenant create exception:", error);
    return NextResponse.json({ ok: false, message: "الإنشاء وقف — السبب اتسجل في اللوج" }, { status: 500 });
  }
}
