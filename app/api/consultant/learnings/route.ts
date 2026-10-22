import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireAdminApi } from "@/lib/admin-api-guard";

/**
 * GET /api/consultant/learnings
 * Get all learnings from consultant_learnings table
 */
export async function GET(): Promise<NextResponse> {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "القاعدة ما اتوصلش بيها — القواعد المحفوظة ما قريتش" }, { status: 500 });
    }

    const { data, error } = await supabase
      .from("consultant_learnings")
      .select("id, instruction, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[ConsultantLearnings] Error fetching:", error);
      return NextResponse.json({ error: "قواعد المعرفة ما قريتش من القاعدة" }, { status: 500 });
    }

    return NextResponse.json({ learnings: data || [] });
  } catch (error) {
    console.error("[ConsultantLearnings] Error:", error);
    return NextResponse.json(
      { error: "قواعد المعرفة ما قريتش — السبب اتسجل في اللوج" },
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
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const body = await request.json();
    const { instruction } = body;

    if (!instruction || typeof instruction !== "string" || !instruction.trim()) {
      return NextResponse.json(
        { error: "مفيش كلام مكتوب — القاعدة محتاجة جملة تتحفظ" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "القاعدة ما اتوصلش بيها — القاعدة ما اتحفظتش" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("consultant_learnings")
      .insert({ instruction: instruction.trim() })
      .select()
      .single();

    if (error || !data) {
      console.error("[ConsultantLearnings] Error saving:", error);
      // A learning kept only in this request's memory is a learning that never was: the process dies
      // with the request, so answering «saved» here taught the owner his manager knew things he did not.
      return NextResponse.json(
        { error: "القاعدة ما اتحفظتش في القاعدة — اكتبها تاني بعد ما تتصل" },
        { status: 500 }
      );
    }

    // --- SAA vInfinity AUTO-COMPILATION SEEDING ---
    try {
      const { askGroq } = await import("@/lib/ai-orchestrator");
      const { semanticCache } = await import("@/lib/semantic-cache");

      const generatorPrompt = `Given this business learning/rule for Azenith Living:
"${instruction.trim()}"

Generate 5 typical customer questions in Egyptian Arabic and 5 in English that someone might ask that would be answered by this learning.
Return JSON array of strings only. Format: ["question 1", "question 2", ...]`;

      const genRes = await askGroq(generatorPrompt, { jsonMode: true, temperature: 0.4 });
      if (genRes.success) {
        const questionsArray = JSON.parse(genRes.content) as string[];
        if (Array.isArray(questionsArray)) {
          const seedPromises = questionsArray.map(q =>
            semanticCache.set(q, instruction.trim(), {
              context: "consultant_learnings",
              source: "admin_dashboard_learning",
              confidence: 0.95
            })
          );
          await Promise.all(seedPromises);
          console.log(`[Self-Evolution] SAA vInfinity auto-seeded cache with ${questionsArray.length} questions for new learning.`);
        }
      }
    } catch (cacheErr) {
      console.error("[ConsultantLearnings] SAA vInfinity auto-seeding failed:", cacheErr);
    }

    console.log("[ConsultantLearnings] Saved:", instruction.substring(0, 60));
    return NextResponse.json({ success: true, learning: data });
  } catch (error) {
    console.error("[ConsultantLearnings] Error:", error);
    return NextResponse.json(
      { error: "الحفظ وقف — السبب اتسجل في اللوج" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/consultant/learnings?id=xxx
 * Update a learning by ID
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const { instruction } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "مفيش إشارة للقاعدة اللي تتعدّل" },
        { status: 400 }
      );
    }

    if (!instruction || typeof instruction !== "string" || !instruction.trim()) {
      return NextResponse.json(
        { error: "مفيش كلام مكتوب — القاعدة محتاجة جملة" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "القاعدة ما اتوصلش بيها — التعديل ما اتحفظش" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("consultant_learnings")
      .update({ instruction: instruction.trim() })
      .eq("id", id)
      .select("id, instruction, created_at")
      .single();

    if (error || !data) {
      console.error("[ConsultantLearnings] Error updating:", error);
      return NextResponse.json(
        { error: "التعديل ما اتحفظش — القاعدة ترجّع زي ما كانت" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, learning: data });
  } catch (error) {
    console.error("[ConsultantLearnings] Error:", error);
    return NextResponse.json(
      { error: "التعديل وقف — السبب اتسجل في اللوج" },
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
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "مفيش إشارة للقاعدة اللي تتشال" },
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
      .from("consultant_learnings")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) {
      console.error("[ConsultantLearnings] Error deleting:", error);
      return NextResponse.json(
        { error: "القاعدة ما اتشالتش" },
        { status: 500 }
      );
    }

    // Asked to erase one row, the door reports how many actually went, because a delete that matched
    // nothing used to answer «success» and leave the rule on the shelf.
    const gone = removed?.length ?? 0;
    if (gone === 0) {
      return NextResponse.json({ error: "مفيش قاعدة متخزنة بالإشارة دي — فما اتشالش حاجة" }, { status: 404 });
    }

    return NextResponse.json({ success: true, removed: gone });
  } catch (error) {
    console.error("[ConsultantLearnings] Error:", error);
    return NextResponse.json(
      { error: "المسح وقف — السبب اتسجل في اللوج" },
      { status: 500 }
    );
  }
}
