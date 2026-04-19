import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new Error("Supabase client not available");

    const { data, error } = await supabase
      .from("consultant_learnings")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Map to the format the UI expects
    const knowledge = (data || []).map(item => ({
      id: item.id,
      category: "عام",
      key: "تعليمات إدارية",
      value: item.instruction,
      usage_count: 0,
      created_at: item.created_at
    }));

    return NextResponse.json({ knowledge });
  } catch (error: any) {
    console.error("[SalesLeader] Knowledge API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
