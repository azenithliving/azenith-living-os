import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * GET /api/consultant/learnings
 * Get all learnings from consultant_learnings table
 */
export async function GET(): Promise<NextResponse> {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database not initialized" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("consultant_learnings")
      .select("id, instruction, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[ConsultantLearnings] Error fetching:", error);
      return NextResponse.json(
        { error: "Failed to fetch learnings" },
        { status: 500 }
      );
    }

    return NextResponse.json({ learnings: data || [] });
  } catch (error) {
    console.error("[ConsultantLearnings] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/consultant/learnings
 * Save a new learning/instruction from the admin dashboard
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { instruction } = body;

    if (!instruction || typeof instruction !== "string" || !instruction.trim()) {
      return NextResponse.json(
        { error: "Missing required field: instruction" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database not initialized" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("consultant_learnings")
      .insert({ instruction: instruction.trim() })
      .select()
      .single();

    if (error) {
      console.error("[ConsultantLearnings] Error saving:", error);
      return NextResponse.json(
        { error: "Failed to save learning", details: error.message },
        { status: 500 }
      );
    }

    console.log("[ConsultantLearnings] Saved:", instruction.substring(0, 60));
    return NextResponse.json({ success: true, learning: data });
  } catch (error) {
    console.error("[ConsultantLearnings] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/consultant/learnings?id=xxx
 * Delete a learning by ID
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing id parameter" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database not initialized" },
        { status: 500 }
      );
    }

    const { error } = await supabase
      .from("consultant_learnings")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[ConsultantLearnings] Error deleting:", error);
      return NextResponse.json(
        { error: "Failed to delete learning" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ConsultantLearnings] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
