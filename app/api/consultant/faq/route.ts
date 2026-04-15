import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * GET /api/consultant/faq
 * Get all FAQ entries
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
      .from("consultant_faq")
      .select("id, question, answer, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[ConsultantFAQ] Error fetching:", error);
      return NextResponse.json(
        { error: "Failed to fetch FAQ" },
        { status: 500 }
      );
    }

    return NextResponse.json({ faq: data || [] });
  } catch (error) {
    console.error("[ConsultantFAQ] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/consultant/faq
 * Create a new FAQ entry and mark the pending question as answered
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { question, answer, originalPendingQuestionId } = body;

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "Missing required field: question" },
        { status: 400 }
      );
    }

    if (!answer || typeof answer !== "string") {
      return NextResponse.json(
        { error: "Missing required field: answer" },
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

    // Create FAQ entry
    const { data: faqData, error: faqError } = await supabase
      .from("consultant_faq")
      .insert({
        question: question.trim(),
        answer: answer.trim(),
        original_pending_question_id: originalPendingQuestionId || null,
      })
      .select()
      .single();

    if (faqError) {
      console.error("[ConsultantFAQ] Error creating FAQ:", faqError);
      return NextResponse.json(
        { error: "Failed to create FAQ" },
        { status: 500 }
      );
    }

    // If there's an original pending question, update its status
    if (originalPendingQuestionId) {
      const { error: updateError } = await supabase
        .from("consultant_pending_questions")
        .update({
          status: "answered",
          answered_at: new Date().toISOString(),
        })
        .eq("id", originalPendingQuestionId);

      if (updateError) {
        console.error("[ConsultantFAQ] Error updating pending question:", updateError);
        // Don't fail the request, just log the error
      }
    }

    return NextResponse.json({ success: true, faq: faqData });
  } catch (error) {
    console.error("[ConsultantFAQ] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/consultant/faq?id=xxx
 * Delete a FAQ entry by ID
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
      .from("consultant_faq")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[ConsultantFAQ] Error deleting:", error);
      return NextResponse.json(
        { error: "Failed to delete FAQ" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ConsultantFAQ] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
