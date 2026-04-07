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

    const { id: pageId } = await params;
    const supabase = getSupabaseAdminClient();

    const { data: sections, error } = await supabase
      .from("page_sections")
      .select("*")
      .eq("page_id", pageId)
      .eq("company_id", tenant.id)
      .order("position", { ascending: true });

    if (error) {
      console.error("Sections fetch error:", error);
      return NextResponse.json(
        { ok: false, message: "Failed to fetch sections" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      sections: sections || [],
    });
  } catch (error) {
    console.error("Sections API error:", error);
    return NextResponse.json(
      { ok: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}