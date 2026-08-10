import { NextRequest, NextResponse } from "next/server";
import { askGroq } from "@/lib/ai-orchestrator";
import { requireAdminApi } from "@/lib/admin-api-guard";
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

function buildFallback(body: AnalyzeRequest) {
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
    note: "تحليل تلقائي أولي — اضغط التحليل العميق بعد توفر المزيد من البيانات.",
  };
}

/**
 * POST /api/admin/leads/analyze
 * Generates an Arabic psychological + sales profile for a lead from
 * conversation + radar telemetry using the AI.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const body = (await request.json()) as AnalyzeRequest;
    const fallback = buildFallback(body);

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

    const result = await askGroq(prompt, {
      maxTokens: 700,
      temperature: 0.5,
      jsonMode: true,
    });

    if (result.success && result.content) {
      try {
        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return NextResponse.json({ profile: parsed, generated: true });
        }
      } catch {
        // fall through to fallback
      }
    }

    return NextResponse.json({ profile: fallback, generated: false });
  } catch (error) {
    console.error("[LeadAnalyze] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
