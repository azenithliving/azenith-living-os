import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { askGroq } from "@/lib/ai-orchestrator";
import { requireAdminApi } from "@/lib/admin-api-guard";

interface AuditQuestion {
  question: string;
  category: string;
  severity: "low" | "medium" | "high";
  suggested_learning?: string;
}

function parseQuestions(content: string): AuditQuestion[] {
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  const parsed = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item) => ({
      question: typeof item.question === "string" ? item.question.trim() : "",
      category: typeof item.category === "string" ? item.category.trim() : "general",
      severity: ["low", "medium", "high"].includes(item.severity) ? item.severity : "medium",
      suggested_learning: typeof item.suggested_learning === "string" ? item.suggested_learning.trim() : undefined,
    }))
    .filter((item) => item.question)
    .slice(0, 8);
}

export async function POST(): Promise<NextResponse> {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const { data, error } = await supabase
      .from("consultant_learnings")
      .select("instruction")
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) {
      console.error("[KnowledgeAudit] Failed to load learnings:", error);
      return NextResponse.json({ error: "Failed to load learnings" }, { status: 500 });
    }

    const learnings = (data || []).map((row) => row.instruction).filter(Boolean);
    if (learnings.length === 0) {
      return NextResponse.json({
        questions: [
          {
            question: "What locations in Egypt does Azenith Living serve, and are there any excluded areas?",
            category: "coverage",
            severity: "high",
            suggested_learning: "Azenith Living serves ...",
          },
        ],
      });
    }

    const prompt = `Audit these approved Azenith Living consultant learnings for missing policies, contradictions, and sales-risk gaps.

Return JSON only as an array. Each item must have:
- question: one clear question the admin should answer
- category: coverage | pricing | style | materials | timeline | warranty | process | escalation | general
- severity: low | medium | high
- suggested_learning: optional draft rule if the answer is known from context

Focus on practical gaps that could affect customer replies: location coverage, budgets, supported styles, execution limits, timelines, warranties, escalation, deposits, measurements, and WhatsApp follow-up.
Ask no more than 8 questions.

Learnings:
${learnings.map((learning, index) => `${index + 1}. ${learning}`).join("\n")}`;

    const result = await askGroq(prompt, {
      maxTokens: 1200,
      temperature: 0.25,
      jsonMode: true,
    });

    if (!result.success) {
      return NextResponse.json({ questions: [], warning: "AI audit unavailable right now" });
    }

    return NextResponse.json({ questions: parseQuestions(result.content) });
  } catch (error) {
    console.error("[KnowledgeAudit] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
