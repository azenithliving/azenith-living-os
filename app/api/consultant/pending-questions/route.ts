import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireAdminApi } from "@/lib/admin-api-guard";

/**
 * The admin desk's view of what the consultant could not answer.
 *
 * It reads and writes with the service client, so every verb here asks the admin gate
 * first: measured before this line existed, an anonymous request got a real customer
 * question and his session key back, and the same address accepted edits and deletes.
 *
 * Nothing here falls back to request memory any more. A queue held in a Map dies with the
 * function invocation, so answering «saved» about it put a question on the owner's desk that
 * no next visit could ever find.
 *
 * GET /api/consultant/pending-questions
 * Get all pending questions
 */
export async function GET(): Promise<NextResponse> {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "القاعدة ما اتوصلش بيها — الأسئلة المعلّقة ما قريتش" }, { status: 500 });
    }

    const { data, error } = await supabase
      .from("consultant_pending_questions")
      .select("id, question, session_id, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[PendingQuestions] Error fetching:", error);
      return NextResponse.json({ error: "الأسئلة المعلّقة ما قريتش من القاعدة" }, { status: 500 });
    }

    return NextResponse.json({ questions: data || [] });
  } catch (error) {
    console.error("[PendingQuestions] Error:", error);
    return NextResponse.json(
      { error: "القراءة وقفت — السبب اتسجل في اللوج" },
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
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const body = await request.json();
    const { question, sessionId } = body;

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "مفيش سؤال مكتوب — مفيش حاجة تتحفظ في القائمة" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "القاعدة ما اتوصلش بيها — السؤال ما اتسجلش" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("consultant_pending_questions")
      .insert({
        question: question.trim(),
        session_id: sessionId || null,
        status: "pending",
      })
      .select()
      .single();

    if (error || !data) {
      console.error("[PendingQuestions] Error creating:", error);
      return NextResponse.json(
        { error: "السؤال ما اتسجلش في القاعدة" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, question: data });
  } catch (error) {
    console.error("[PendingQuestions] Error:", error);
    return NextResponse.json(
      { error: "التسجيل وقف — السبب اتسجل في اللوج" },
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
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "مفيش إشارة للسؤال اللي يتحلّ" }, { status: 400 });

    const { answered_reply } = await request.json();
    if (!answered_reply) return NextResponse.json({ error: "مفيش ردّ مكتوب — السؤال يفضل معلّق" }, { status: 400 });

    const supabase = getSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ error: "القاعدة ما اتوصلش بيها — الردّ ما اتحفظش" }, { status: 500 });

    // Retrieve original question for compilation
    const { data: qData } = await supabase
      .from("consultant_pending_questions")
      .select("question, session_id")
      .eq("id", id)
      .single();

    const { data: markedRow, error } = await supabase
      .from("consultant_pending_questions")
      .update({ status: "answered", answered_reply })
      .eq("id", id)
      .select("id, status")
      .single();

    if (error || !markedRow) {
      // Non-destructive: keep the pending question in the database. Never delete
      // a customer question to work around a missing column — surface the error
      // so the admin can fix the schema instead of losing data.
      console.error("[PendingQuestions] Update error:", error);
      return NextResponse.json(
        { error: "الردّ ما اتحفظش على السؤال — القائمة ترجّع زي ما كانت", details: error?.message ?? null },
        { status: 500 }
      );
    }

    // --- SAA vInfinity SELF-EVOLUTION SEEDING ---
    let compiled: { saved: boolean; note: string } | null = null;
    if (qData && qData.question && qData.question !== "DIRECT_MESSAGE") {
      try {
        const originalQuestion = qData.question;

        // 1. Insert into consultant_learnings table. This door is the one owner of the rule an
        // answer turns into: the desk used to write its own row beside this one, so every reply
        // the owner gave taught the manager the same thing twice, in two shapes.
        const { error: seedErr } = await supabase.from("consultant_learnings").insert({
          instruction: `سؤال: ${originalQuestion} -> إجابة: ${answered_reply}`
        }).select("id");
        compiled = seedErr
          ? { saved: false, note: "الردّ اتحفظ على السؤال، بس القاعدة ما اتكوّنتش" }
          : { saved: true, note: "السؤال ده بقى قاعدة عند مدير المبيعات" };

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
        compiled = { saved: false, note: "الردّ اتحفظ على السؤال، بس القاعدة اللي بتتكوّن منه ما اتحفظتش" };
      }
    }

    return NextResponse.json({ success: true, compiled });
  } catch (error) {
    console.error("[PendingQuestions] Error:", error);
    return NextResponse.json({ error: "التسجيل وقف — السبب اتسجل في اللوج" }, { status: 500 });
  }
}

/**
 * DELETE /api/consultant/pending-questions?id=xxx
 * Delete a pending question by ID
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "مفيش إشارة للسؤال اللي يتشال" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "القاعدة ما اتوصلش بيها — المسح ما تمّش" },
        { status: 500 }
      );
    }

    const { data: removed, error } = await supabase
      .from("consultant_pending_questions")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) {
      console.error("[PendingQuestions] Error deleting:", error);
      return NextResponse.json(
        { error: "السؤال ما اتشالوش" },
        { status: 500 }
      );
    }

    const gone = removed?.length ?? 0;
    if (gone === 0) {
      return NextResponse.json({ error: "مفيش سؤال متخزن بالإشارة دي — فما اتشالش حاجة" }, { status: 404 });
    }

    return NextResponse.json({ success: true, removed: gone });
  } catch (error) {
    console.error("[PendingQuestions] Error:", error);
    return NextResponse.json(
      { error: "المسح وقف — السبب اتسجل في اللوج" },
      { status: 500 }
    );
  }
}
