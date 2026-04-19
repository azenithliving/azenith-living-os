import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new Error("Supabase client not available");

    const { data, error } = await supabase
      .from("consultant_pending_questions")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Map to the format the UI expects
    const pending = (data || []).map(item => ({
      id: item.id,
      question: item.question,
      asked_count: 1,
      answered: item.status === "answered",
      created_at: item.created_at
    }));

    return NextResponse.json({ pending });
  } catch (error: any) {
    console.error("[SalesLeader] Pending API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
