import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * GET /api/consultant/pending-questions
 * Get all pending questions
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
      .from("consultant_pending_questions")
      .select("id, question, session_id, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[PendingQuestions] Error fetching:", error);
      return NextResponse.json(
        { error: "Failed to fetch pending questions" },
        { status: 500 }
      );
    }

    return NextResponse.json({ questions: data || [] });
  } catch (error) {
    console.error("[PendingQuestions] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/consultant/pending-questions
 * Create a new pending question (called when consultant doesn't know the answer)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { question, sessionId, userEmail } = body;

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "Missing required field: question" },
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
      .from("consultant_pending_questions")
      .insert({
        question: question.trim(),
        session_id: sessionId || null,
        user_email: userEmail || null,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("[PendingQuestions] Error creating:", error);
      return NextResponse.json(
        { error: "Failed to create pending question" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, question: data });
  } catch (error) {
    console.error("[PendingQuestions] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/consultant/pending-questions?id=xxx
 * Delete a pending question by ID
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
      .from("consultant_pending_questions")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[PendingQuestions] Error deleting:", error);
      return NextResponse.json(
        { error: "Failed to delete pending question" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PendingQuestions] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
