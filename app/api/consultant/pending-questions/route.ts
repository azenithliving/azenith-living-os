import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const IN_MEMORY_PENDING_QUESTIONS = new Map<string, { id: string; question: string; session_id?: string; status: string; created_at: string; answered_reply?: string }>();

/**
 * GET /api/consultant/pending-questions
 * Get all pending questions
 */
export async function GET(): Promise<NextResponse> {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      const memoryQuestions = Array.from(IN_MEMORY_PENDING_QUESTIONS.values())
        .filter(q => q.status === "pending")
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      return NextResponse.json({ questions: memoryQuestions });
    }

    const { data, error } = await supabase
      .from("consultant_pending_questions")
      .select("id, question, session_id, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[PendingQuestions] Error fetching:", error);
      const memoryQuestions = Array.from(IN_MEMORY_PENDING_QUESTIONS.values())
        .filter(q => q.status === "pending")
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      return NextResponse.json({ questions: memoryQuestions });
    }

    const live = data || [];
    const memoryQuestions = Array.from(IN_MEMORY_PENDING_QUESTIONS.values())
      .filter(q => q.status === "pending");
    return NextResponse.json({ questions: [...memoryQuestions, ...live] });
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
      const fallbackId = `question_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const fallback = {
        id: fallbackId,
        question: question.trim(),
        session_id: sessionId || null,
        user_email: userEmail || null,
        status: "pending",
        created_at: new Date().toISOString(),
      };
      IN_MEMORY_PENDING_QUESTIONS.set(fallbackId, fallback);
      console.warn("[PendingQuestions] Falling back to memory queue:", fallbackId);
      return NextResponse.json({ success: true, question: fallback });
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
      const fallbackId = `question_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const fallback = {
        id: fallbackId,
        question: question.trim(),
        session_id: sessionId || null,
        user_email: userEmail || null,
        status: "pending",
        created_at: new Date().toISOString(),
      };
      IN_MEMORY_PENDING_QUESTIONS.set(fallbackId, fallback);
      console.warn("[PendingQuestions] Falling back to memory queue:", fallbackId);
      return NextResponse.json({ success: true, question: fallback });
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
 * PATCH /api/consultant/pending-questions?id=xxx
 * Mark a question as answered with the admin's reply (triggers auto-send to visitor)
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const { answered_reply } = await request.json();
    if (!answered_reply) return NextResponse.json({ error: "Missing answered_reply" }, { status: 400 });

    const supabase = getSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ error: "DB not initialized" }, { status: 500 });

    // Retrieve original question for compilation
    const { data: qData } = await supabase
      .from("consultant_pending_questions")
      .select("question, session_id")
      .eq("id", id)
      .single();

    const { error } = await supabase
      .from("consultant_pending_questions")
      .update({ status: "answered", answered_reply })
      .eq("id", id);

    if (error) {
      // Non-destructive: keep the pending question in the database. Never delete
      // a customer question to work around a missing column — surface the error
      // so the admin can fix the schema instead of losing data.
      console.error("[PendingQuestions] Update error:", error);
      return NextResponse.json(
        { error: "Failed to mark question as answered", details: error.message },
        { status: 500 }
      );
    }

    const existing = IN_MEMORY_PENDING_QUESTIONS.get(id);
    if (existing) {
      existing.status = "answered";
      existing.answered_reply = answered_reply;
    }

    // --- SAA vInfinity SELF-EVOLUTION SEEDING ---
    if (qData && qData.question && qData.question !== "DIRECT_MESSAGE") {
      try {
        const originalQuestion = qData.question;
        
        // 1. Insert into consultant_learnings table
        await supabase.from("consultant_learnings").insert({
          instruction: `سؤال: ${originalQuestion} -> إجابة: ${answered_reply}`
        });

        // 2. Generate 10 variations in background using Swarm compiler
        const { askGroq } = await import("@/lib/ai-orchestrator");
        const { semanticCache } = await import("@/lib/semantic-cache");

        const generatorPrompt = `Given this customer question:
"${originalQuestion}"
And this approved answer:
"${answered_reply}"

Generate 5 typical variations in Egyptian Arabic and 5 variations in English that a user might ask for this same topic.
Return JSON array of strings only. Format: ["Q1", "Q2", ...]`;

        const genRes = await askGroq(generatorPrompt, {
          jsonMode: true,
          temperature: 0.4
        });

        if (genRes.success) {
          const variations = JSON.parse(genRes.content) as string[];
          if (Array.isArray(variations)) {
            // Seed all variations and the original question in the Semantic Cache
            const seedPromises = [...variations, originalQuestion].map(variant =>
              semanticCache.set(variant, answered_reply, {
                context: "consultant_faq",
                source: "admin_compiled_learning",
                confidence: 0.95
              })
            );
            await Promise.all(seedPromises);
            console.log(`[Self-Evolution] SAA vInfinity compiled and seeded ${variations.length + 1} variations for: "${originalQuestion}"`);
          }
        }
      } catch (evolutionErr) {
        console.error("[PendingQuestions] Self-evolution compiling failed:", evolutionErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
