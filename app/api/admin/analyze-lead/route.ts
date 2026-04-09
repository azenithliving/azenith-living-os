import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SessionState } from "@/stores/useSessionStore";

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

interface AnalyzeLeadRequest {
  sessionState: SessionState;
  bufferedInteractions?: number;
}

interface AnalyzeLeadResponse {
  salesTip: string;
  confidence: "high" | "medium" | "low";
  analyzedAt: string;
}

/**
 * POST /api/admin/analyze-lead
 * Neural Sales Insights - Analyzes lead behavioral data and returns Arabic sales tip
 */
export async function POST(request: NextRequest): Promise<NextResponse<AnalyzeLeadResponse | { error: string }>> {
  // Check if API key is configured
  if (!process.env.GEMINI_API_KEY) {
    console.error("[Neural Sales] GEMINI_API_KEY not configured");
    return NextResponse.json(
      { error: "AI service not configured" },
      { status: 503 }
    );
  }

  try {
    const body: AnalyzeLeadRequest = await request.json();
    const { sessionState, bufferedInteractions = 0 } = body;

    // Skip analysis if no meaningful data
    if (sessionState.leadScore < 5 && bufferedInteractions === 0) {
      return NextResponse.json({
        salesTip: "البيانات غير كافية للتحليل - انتظر تفاعل أكثر من الزائر",
        confidence: "low",
        analyzedAt: new Date().toISOString(),
      });
    }

    // Build the luxury consultant prompt
    const prompt = buildLuxuryConsultantPrompt(sessionState, bufferedInteractions);

    // Call Gemini API
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text().trim();
    
    console.log("🧠 AI Insight Generated:", {
      salesTip: text,
      leadScore: sessionState.leadScore,
      bufferedInteractions,
      timestamp: new Date().toISOString(),
    });

    // Parse and validate response
    const salesTip = extractSalesTip(text);
    const confidence = determineConfidence(sessionState.leadScore, bufferedInteractions);

    const analysis: AnalyzeLeadResponse = {
      salesTip,
      confidence,
      analyzedAt: new Date().toISOString(),
    };

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("[Neural Sales] Analysis failed:", error);
    return NextResponse.json(
      { error: "Failed to analyze lead" },
      { status: 500 }
    );
  }
}

/**
 * Build luxury real estate consultant prompt
 */
function buildLuxuryConsultantPrompt(state: SessionState, bufferedInteractions: number): string {
  const {
    leadScore,
    intent,
    roomIntent,
    styleSwitches,
    userPersona,
    behavioralReport,
    userProfile,
  } = state;

  const stylePrefs = userProfile.stylePreferences || {};
  const styleEntries = Object.entries(stylePrefs) as [string, { roomCount?: number }][];
  
  // Identify long hovers and high engagement
  const hasLongHovers = bufferedInteractions > 10;
  const hasStyleAffinity = styleEntries.length > 0;
  const topStyle = styleEntries
    .sort((a, b) => (b[1].roomCount || 0) - (a[1].roomCount || 0))[0]?.[0] || "unknown";

  return `أنت مستشار عقارات فاخرة محترف في مصر. مهمتك تحليل بيانات سلوك الزائر وتقديم نصيحة مبيعات واحدة فقط (جملة واحدة) بالعربية.

بيانات الزائر:
- Lead Score: ${leadScore}/100
- نية الشراء: ${intent}
- مستوى اليقين: ${userPersona.certainty}
- مستوى الاهتمام: ${userPersona.interestLevel}
- الغرف المشاهدة: ${roomIntent.slice(0, 5).join(", ") || "غير محدد"}
- الأسلوب المفضل: ${userPersona.preferredStyle || topStyle}
- عدد تبديل الأنماط: ${styleSwitches} (يشير إلى مقارنة الخيارات)
- تفاعل مخزن (buffered): ${bufferedInteractions} نقطة

${behavioralReport ? `ملخص سلوكي: ${behavioralReport.behaviorSummary}` : ""}

${hasLongHovers ? "ملاحظة: الزائر قضى وقتًا طويلاً في التصفح (hovers طويلة)" : ""}
${hasStyleAffinity ? `ملاحظة: يفضل أسلوب ${topStyle} بشكل واضح` : ""}

التعليمات:
1. قدم جملة واحدة فقط (نصيحة مبيعات)
2. باللغة العربية الفصحى
3. ركز على أسلوب التفاوض المناسب لهذا العميل
4. اذكر نقطة قوة واحدة للعميل (مثال: "يبحث عن الجودة", "يقدر التفاصيل")
5. لا تستخدم أكثر من 30 كلمة

مثال: "عميل يقدر الجودة - ركز على التفاصيل الفاخرة في ${topStyle} وقدم له باقة VIP"

نصيحتك:`;
}

/**
 * Extract sales tip from AI response
 */
function extractSalesTip(text: string): string {
  // Clean up the response
  let tip = text
    .replace(/^["']|["']$/g, "") // Remove quotes
    .replace(/\n/g, " ") // Replace newlines with space
    .trim();

  // If response is too long, take first sentence
  const sentences = tip.split(/[.!?]/);
  if (sentences.length > 1 && tip.length > 100) {
    tip = sentences[0] + ".";
  }

  // Ensure it's not empty
  if (!tip || tip.length < 5) {
    tip = "ركز على بناء الثقة - العميل في مرحلة تقييم الخيارات";
  }

  return tip;
}

/**
 * Determine confidence level based on data quality
 */
function determineConfidence(leadScore: number, bufferedInteractions: number): "high" | "medium" | "low" {
  if (leadScore > 50 && bufferedInteractions > 20) return "high";
  if (leadScore > 25 || bufferedInteractions > 10) return "medium";
  return "low";
}

export type { AnalyzeLeadRequest, AnalyzeLeadResponse };
