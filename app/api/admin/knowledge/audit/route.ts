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

  // A model that answers with brackets but not with JSON is a common answer, and throwing here
  // used to turn the whole audit into an unnamed 500. An unreadable reply is a missing list.
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((item): item is Record<string, unknown> =>
      item !== null && typeof item === "object")
    .map((item) => ({
      question: typeof item.question === "string" ? item.question.trim() : "",
      category: typeof item.category === "string" ? item.category.trim() : "general",
      severity: ["low", "medium", "high"].includes(String(item.severity)) ? (item.severity as "low" | "medium" | "high") : "medium",
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
      return NextResponse.json({ error: "القاعدة ما اتوصلش بيها — التدقيق ما ياقدرش يقرأ قواعدك" }, { status: 500 });
    }

    const { data, error } = await supabase
      .from("consultant_learnings")
      .select("instruction")
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) {
      console.error("[KnowledgeAudit] Failed to load learnings:", error);
      return NextResponse.json(
        { error: "قواعد المعرفة ما قريتش — التدقيق محتاج يقرأها الأول", code: error.code ?? null },
        { status: 500 }
      );
    }

    const learnings = (data || []).map((row) => row.instruction).filter(Boolean);
    if (learnings.length === 0) {
      return NextResponse.json({
        questions: [
          {
            question: "أزينث ليفينغ بتغطّي أنهي مناطق في مصر، وفي مناطق بترفضها؟",
            category: "coverage",
            severity: "high",
            suggested_learning: "أزينث ليفينغ بتخدم ...",
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
      // A missing model is not «no gaps». It is a door that did not run, and it has to arrive that way —
      // a 200 with an empty list teaches the owner that his knowledge is clean when nothing looked.
      return NextResponse.json(
        { error: "مفيش نموذج ذكي ردّ دلوقتي — التدقيق بيحتاج نموذج، وقواعدك المحفوظة ما اتلمستش" },
        { status: 503 }
      );
    }

    const parsed = parseQuestions(result.content);
    if (!parsed.length && String(result.content ?? "").trim().length > 40) {
      // The model answered but nothing survived the parse: say that instead of reporting a clean shop.
      return NextResponse.json(
        { error: "النموذج ردّ بردّ ما اتقراش كامعًد أسئلة — التدقيق ما تمّش" },
        { status: 502 }
      );
    }

    return NextResponse.json({ questions: parsed });
  } catch (error) {
    const raw =
      error instanceof Error ? error.message
      : typeof (error as { message?: unknown } | null)?.message === "string"
        ? String((error as { message: string }).message)
        : "";
    console.error("[KnowledgeAudit] Error:", error);
    // A machine sentence is a log line, not owner copy. The screen gets the state; the cause stays here.
    const usable = /[؀-ۿ]/.test(raw) ? raw : "سببه اتسجل في اللوج مش على الشاشة";
    return NextResponse.json({ error: `التدقيق وقف — ${usable}` }, { status: 500 });
  }
}
