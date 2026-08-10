import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireAdminApi } from "@/lib/admin-api-guard";

const IN_MEMORY_LEARNINGS = new Map<string, { id: string; instruction: string; created_at: string }>();

/**
 * GET /api/consultant/learnings
 * Get all learnings from consultant_learnings table
 */
export async function GET(): Promise<NextResponse> {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      const memoryLearnings = Array.from(IN_MEMORY_LEARNINGS.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
      return NextResponse.json({ learnings: memoryLearnings });
    }

    const { data, error } = await supabase
      .from("consultant_learnings")
      .select("id, instruction, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[ConsultantLearnings] Error fetching:", error);
      const memoryLearnings = Array.from(IN_MEMORY_LEARNINGS.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
      return NextResponse.json({ learnings: memoryLearnings });
    }

    const live = data || [];
    const memoryLearnings = Array.from(IN_MEMORY_LEARNINGS.values());
    return NextResponse.json({ learnings: [...memoryLearnings, ...live] });
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
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

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
      const fallbackId = `learn_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const fallbackData = {
        id: fallbackId,
        instruction: instruction.trim(),
        created_at: new Date().toISOString(),
      };
      IN_MEMORY_LEARNINGS.set(fallbackId, fallbackData);
      console.warn("[ConsultantLearnings] Falling back to in-memory learning store:", fallbackId);
      return NextResponse.json({ success: true, learning: fallbackData });
    }

    const { data, error } = await supabase
      .from("consultant_learnings")
      .insert({ instruction: instruction.trim() })
      .select()
      .single();

    if (error) {
      console.error("[ConsultantLearnings] Error saving:", error);
      const fallbackId = `learn_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const fallbackData = {
        id: fallbackId,
        instruction: instruction.trim(),
        created_at: new Date().toISOString(),
      };
      IN_MEMORY_LEARNINGS.set(fallbackId, fallbackData);
      console.warn("[ConsultantLearnings] Falling back to memory write for learning:", fallbackId);
      return NextResponse.json({ success: true, learning: fallbackData });
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
      { error: "Internal server error" },
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
        { error: "Missing id parameter" },
        { status: 400 }
      );
    }

    if (!instruction || typeof instruction !== "string" || !instruction.trim()) {
      return NextResponse.json(
        { error: "Missing required field: instruction" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      const existing = IN_MEMORY_LEARNINGS.get(id);
      if (!existing) {
        return NextResponse.json({ error: "Learning not found" }, { status: 404 });
      }
      const updated = { ...existing, instruction: instruction.trim() };
      IN_MEMORY_LEARNINGS.set(id, updated);
      return NextResponse.json({ success: true, learning: updated });
    }

    const { data, error } = await supabase
      .from("consultant_learnings")
      .update({ instruction: instruction.trim() })
      .eq("id", id)
      .select("id, instruction, created_at")
      .single();

    if (error) {
      console.error("[ConsultantLearnings] Error updating:", error);
      return NextResponse.json(
        { error: "Failed to update learning" },
        { status: 500 }
      );
    }

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
