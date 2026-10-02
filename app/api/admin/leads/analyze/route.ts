import { NextRequest, NextResponse } from "next/server";
import { askWithFloor } from "@/lib/ai-orchestrator";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { answeredByLabel } from "@/lib/ops/key-desk";
import { summarizeInterest, translateTag } from "@/lib/lead-insights";

interface AnalyzeRequest {
  name?: string;
  roomType?: string;
  budget?: string;
  location?: string;
  summary?: string;
  messages?: Array<{ role: string; content: string }>;
  telemetry?: {
    current_path?: string;
    attention_score?: number;
    hovered_elements?: string[];
    updated_at?: string;
  };
}

function buildFallback(body: AnalyzeRequest, note: string) {
  const telemetry = body.telemetry;
  const summary = summarizeInterest(telemetry?.hovered_elements);
  const room = body.roomType && body.roomType !== "غير محدد" ? body.roomType : "غير محدد";
  const lastMessages = (body.messages || []).slice(-4).map((m) => m.content).join(" | ");

  return {
    interests: summary.top.length > 0
      ? `أكثر ما أطال النظر إليه: ${summary.top.join("، ")}.`
      : "لم ترصد الرادار عناصر كافية بعد.",
    style: summary.styleGuess
      ? `يبدو أنه يميل إلى الطراز ${summary.styleGuess}.`
      : "لم تُرصد إشارة واضحة للطراز بعد.",
    personality:
      "الملف الشخصي سيُبنى تلقائيًا بعد توفر مزيد من التفاعل والمحادثة.",
    psychology: "لا توجد بيانات كافية لاستنتاج الحالة النفسية بعد.",
    buying_signals: "لا توجد إشارة شراء واضحة بعد.",
    recommended_approach: `اقترح بخطوة واحدة واضحة بخصوص ${room}، وتابع عبر واتساب، واطرح سؤالًا مفتوحًا.`,
    context: lastMessages ? `آخر ما قاله العميل: ${lastMessages}` : "",
    note,
  };
}

/**
 * POST /api/admin/leads/analyze
 * Generates an Arabic psychological + sales profile for a lead from
 * conversation + radar telemetry using the AI.
 *
 * The chain answers, not one named provider: measured on his own pool, four companies write
 * today, and a door that asks one of them by name goes quiet when that one's minute ceiling is
 * spent. When none answers, the rules' reading is still returned — and the line says who spoke.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: AnalyzeRequest = {};
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    body = (await request.json()) as AnalyzeRequest;

    const telemetry = body.telemetry;
    const interest = summarizeInterest(telemetry?.hovered_elements);
    const translatedTags = interest.all.map(translateTag).join("، ") || "لا يوجد";
    const recentMessages = (body.messages || [])
      .slice(-12)
      .map((m) => `${m.role === "user" ? "العميل" : "المستشار"}: ${m.content}`)
      .join("\n");

    const prompt = `You are a senior sales psychologist analyzing a visitor to Azenith Living (luxury interior design & furniture).

Analyze this lead and produce a PROFESSIONAL ARABIC psychological profile.

Input:
- Name: ${body.name || "unknown"}
- Room type: ${body.roomType || "unknown"}
- Budget: ${body.budget || "unknown"}
- Location: ${body.location || "unknown"}
- AI summary: ${body.summary || "none"}
- Attention score: ${telemetry?.attention_score ?? 0} / 100
- Elements the visitor lingered on (radar): ${translatedTags}
- Page: ${telemetry?.current_path || "/"}
- Recent conversation:
${recentMessages || "No messages yet"}

Return JSON ONLY with these string fields (all in Egyptian Arabic):
{
  "interests": "أهم ما جذب انتباهه فعلًا ولماذا، مرتبطًا بالرادار",
  "style": "الطراز/الألوان/الخامات التي يميل لها",
  "personality": "أسلوب شخصيته في اتخاذ القرار (عقلاني/عاطفي/متردد/مساوم...)",
  "psychology": "الدافع والحالة النفسية (حذر، متحمس، مرتاب، مستعجل...) مع الإشارة لعلامات الخداع/التسعير الحساس",
  "buying_signals": "إشارات استعداد الشراء أو العوائق الواضحة",
  "recommended_approach": "أفضل خطوة مبيعات تالية وخطة المتابعة (متى وماذا)",
  "score_guide": "مؤشر تحويل تقديري من 1 إلى 10 مع جملة تبرر الرقم"
}

Rules: علم نفس واقعي لا مبالغة، لا تخترع بيانات غير موجودة، كل الحقول إلزامية.`;

    const answer = await askWithFloor("customer-analysis", [{ role: "user", content: prompt }], {
      maxTokens: 700,
      temperature: 0.5,
      jsonMode: true,
    });

    const parsed = answer.ok ? readProfile(answer.content) : null;
    if (parsed) {
      return NextResponse.json({ profile: parsed, generated: true, answered_by: answeredByLabel(answer.provider) });
    }

    // No model, or a model that answered with something unreadable: the radar's own counts stay
    // on the screen, and the note says which of the two happened.
    const note = answer.ok
      ? "النموذج ردّ بردّ ما كانش مقروء — اللي ظاهر هنا حساب الرادار."
      : answer.floorLine;
    return NextResponse.json({ profile: buildFallback(body, note), generated: false, answered_by: "قواعد المتجر — من غير مفتاح" });
  } catch (error) {
    // The floor is also the last resort when this door itself breaks: an English status code is
    // not an answer a man reads.
    console.error("[LeadAnalyze] Error:", error);
    return NextResponse.json({
      profile: buildFallback(body, "الباب ما قدرش يوصل للنموذج — اللي ظاهر هنا حساب الرادار من غير مفتاح."),
      generated: false,
      answered_by: "قواعد المتجر — من غير مفتاح",
    });
  }
}

/** The model's JSON, or null when the answer is not a profile. Never a half-parsed guess. */
function readProfile(content: string): Record<string, string> | null {
  const found = content.match(/\{[\s\S]*\}/);
  if (!found) return null;
  try {
    const parsed = JSON.parse(found[0]);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const entries = Object.entries(parsed).filter(([, value]) => typeof value === "string" && (value as string).trim());
    return entries.length ? Object.fromEntries(entries.map(([k, v]) => [k, String(v)])) : null;
  } catch {
    return null;
  }
}
