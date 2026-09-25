import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireAdminApi } from "@/lib/admin-api-guard";

/**
 * Who is allowed to speak for the shop.
 *
 * These rows are what the consultant answers visitors with, verbatim, whenever a
 * question matches one closely enough — so the writer of a row is not a content
 * editor, it is someone authorising a statement made in the owner's name. The
 * endpoint used to be open to any caller with no session at all: an anonymous
 * POST could plant a sentence and have it delivered to every visitor whose
 * wording resembled it. Every handler is admin-gated now, and `approved_by` is
 * taken from the session, never from the request body, because provenance the
 * client supplies is not provenance.
 */

/**
 * GET /api/consultant/faq
 * Get all FAQ entries
 */
export async function GET(): Promise<NextResponse> {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database not initialized" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("consultant_faq")
      .select("id, question, answer, approved_by, is_active, created_at")
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
    const { user, unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

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
        // Provenance comes from the session. A body field would let any caller
        // write who approved it, and the gate trusts exactly that field.
        approved_by: user?.email || "unknown-admin",
        is_active: true,
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
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

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
    console.error("[ConsultantFAQ] Error deleting:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/consultant/faq?id=xxx  { is_active: boolean }
 *
 * Switching a row off, rather than deleting it. The owner is allowed to change
 * his mind about a sentence without destroying the record that it was ever said,
 * and the consultant stops repeating it the moment the switch moves.
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const { user, unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    if (typeof body?.is_active !== "boolean") {
      return NextResponse.json({ error: "is_active must be true or false" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ error: "Database not initialized" }, { status: 500 });

    const { data, error } = await supabase
      .from("consultant_faq")
      .update({ is_active: body.is_active, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, question, is_active, approved_by")
      .maybeSingle();

    if (error) {
      console.error("[ConsultantFAQ] Error updating:", error);
      return NextResponse.json({ error: "Failed to update FAQ" }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ success: true, faq: data, changed_by: user?.email || "unknown-admin" });
  } catch (error) {
    console.error("[ConsultantFAQ] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
