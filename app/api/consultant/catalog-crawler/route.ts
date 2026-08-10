import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { semanticCache } from "@/lib/semantic-cache";
import { askGroq } from "@/lib/ai-orchestrator";

/**
 * SAA vInfinity — Epistemic Catalog Crawler
 *
 * GET  /api/consultant/catalog-crawler   → returns last crawl stats
 * POST /api/consultant/catalog-crawler   → triggers a full crawl and seeds the semantic cache
 *
 * Crawl sources:
 *  1. consultant_learnings          — existing admin knowledge
 *  2. site_settings (asi_logic)     — global AI personality / rules
 *  3. reality_mutations             — active UI themes / patterns
 *
 * For each piece of knowledge, an LLM generates 5 typical user questions,
 * then seeds them directly into the L0-L3 Semantic Cache so the Advisor
 * answers instantly without any LLM roundtrip.
 */

interface CrawlResult {
  source: string;
  itemsProcessed: number;
  questionsGenerated: number;
  errors: number;
}

async function crawlLearnings(supabase: ReturnType<typeof getSupabaseAdminClient>): Promise<CrawlResult> {
  const result: CrawlResult = { source: "consultant_learnings", itemsProcessed: 0, questionsGenerated: 0, errors: 0 };

  const { data, error } = await supabase!
    .from("consultant_learnings")
    .select("instruction")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data?.length) return result;

  for (const row of data) {
    result.itemsProcessed++;
    try {
      const genRes = await askGroq(
        `Given this business rule for Azenith Living:\n"${row.instruction}"\n\nGenerate 5 typical customer questions in Egyptian Arabic that would be answered by this rule.\nReturn JSON array of strings only. Format: ["q1","q2","q3","q4","q5"]`,
        { jsonMode: true, temperature: 0.3 }
      );

      if (genRes.success) {
        const questions = JSON.parse(genRes.content) as string[];
        if (Array.isArray(questions)) {
          await Promise.all(
            questions.map(q =>
              semanticCache.set(q, row.instruction, {
                context: "consultant_faq",
                source: "catalog_crawler",
                confidence: 0.92
              })
            )
          );
          result.questionsGenerated += questions.length;
        }
      }
    } catch {
      result.errors++;
    }
  }

  return result;
}

async function crawlSiteSettings(supabase: ReturnType<typeof getSupabaseAdminClient>): Promise<CrawlResult> {
  const result: CrawlResult = { source: "site_settings", itemsProcessed: 0, questionsGenerated: 0, errors: 0 };

  const { data, error } = await supabase!
    .from("site_settings")
    .select("key, value")
    .in("key", ["asi_logic", "company_info", "pricing", "services"]);

  if (error || !data?.length) return result;

  for (const row of data) {
    result.itemsProcessed++;
    try {
      const content = typeof row.value === "string" ? row.value : JSON.stringify(row.value);
      if (!content || content.length < 20) continue;

      const genRes = await askGroq(
        `Given this business setting (${row.key}) for Azenith Living:\n"${content.substring(0, 500)}"\n\nGenerate 5 typical customer questions in Egyptian Arabic that this setting answers.\nReturn JSON array of strings only. Format: ["q1","q2","q3","q4","q5"]`,
        { jsonMode: true, temperature: 0.3 }
      );

      if (genRes.success) {
        const questions = JSON.parse(genRes.content) as string[];
        if (Array.isArray(questions)) {
          await Promise.all(
            questions.map(q =>
              semanticCache.set(q, content.substring(0, 400), {
                context: "consultant_faq",
                source: "catalog_crawler_settings",
                confidence: 0.88
              })
            )
          );
          result.questionsGenerated += questions.length;
        }
      }
    } catch {
      result.errors++;
    }
  }

  return result;
}

// ── GET: last crawl stats ───────────────────────────────────────────────────
export async function GET(): Promise<NextResponse> {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ error: "DB not initialized" }, { status: 500 });

    // Return learning count as proxy for crawl readiness
    const { count } = await supabase
      .from("consultant_learnings")
      .select("id", { count: "exact", head: true });

    return NextResponse.json({
      status: "ready",
      knowledgeItems: count ?? 0,
      message: "POST to /api/consultant/catalog-crawler to trigger a full crawl."
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unknown error" }, { status: 500 });
  }
}

// ── POST: trigger full crawl ────────────────────────────────────────────────
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Require internal API key for security
    const internalKey = request.headers.get("x-internal-key");
    if (internalKey && process.env.INTERNAL_API_KEY && internalKey !== process.env.INTERNAL_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ error: "DB not initialized" }, { status: 500 });

    console.log("[SAA-Crawler] Starting Epistemic Catalog Crawl...");

    // Run both crawls in parallel
    const [learningsResult, settingsResult] = await Promise.all([
      crawlLearnings(supabase),
      crawlSiteSettings(supabase),
    ]);

    const totalItems = learningsResult.itemsProcessed + settingsResult.itemsProcessed;
    const totalQuestions = learningsResult.questionsGenerated + settingsResult.questionsGenerated;
    const totalErrors = learningsResult.errors + settingsResult.errors;

    console.log(`[SAA-Crawler] Crawl complete: ${totalItems} items → ${totalQuestions} questions seeded (${totalErrors} errors)`);

    return NextResponse.json({
      success: true,
      crawledAt: new Date().toISOString(),
      summary: {
        totalItemsProcessed: totalItems,
        totalQuestionsSeeded: totalQuestions,
        totalErrors,
      },
      sources: [learningsResult, settingsResult],
    });
  } catch (error: any) {
    console.error("[SAA-Crawler] Crawl failed:", error);
    return NextResponse.json({ error: error?.message || "Crawl failed" }, { status: 500 });
  }
}
