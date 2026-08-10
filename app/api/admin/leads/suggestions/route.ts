import { NextRequest, NextResponse } from "next/server";
import { askGroq } from "@/lib/ai-orchestrator";
import { requireAdminApi } from "@/lib/admin-api-guard";

interface LeadContext {
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
  } | null;
}

function fallbackSuggestions(lead: LeadContext): string[] {
  const room = lead.roomType && lead.roomType !== "غير محدد" ? lead.roomType : "المساحة";
  const location = lead.location && lead.location !== "غير محدد" ? ` في ${lead.location}` : "";
  return [
    `تمام، فهمت اهتمام حضرتك بـ ${room}${location}. تحب نبدأ بتحديد المقاسات والستايل الأقرب لذوقك؟`,
    "أقدر أوجهك بشكل أدق لو عرفت هل المطلوب تصميم فقط أم تصميم وتنفيذ كامل؟",
    "لو مناسب، ابعت رقم تواصل وسيتابع معك مستشار متخصص لتقييم التفاصيل بهدوء.",
  ];
}

function parseSuggestions(content: string): string[] {
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  const parsed = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()).slice(0, 3);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const lead = (await request.json()) as LeadContext;
    const recentMessages = (lead.messages || [])
      .slice(-8)
      .map((message) => `${message.role}: ${message.content}`)
      .join("\n");

    const prompt = `You are helping a human Azenith Living sales manager reply during live takeover.

Generate exactly 3 concise customer-facing reply suggestions in polished Egyptian Arabic unless the conversation is clearly English.
Rules:
- No admin prefix.
- No invented prices, discounts, timelines, warranties, or guarantees.
- Each suggestion should ask at most one next question.
- Use the lead context, mood, budget, location, and telemetry if useful.
- Return JSON array of strings only.

Lead:
Name: ${lead.name || "unknown"}
Room/project: ${lead.roomType || "unknown"}
Budget: ${lead.budget || "unknown"}
Location: ${lead.location || "unknown"}
Summary: ${lead.summary || "none"}
Telemetry path: ${lead.telemetry?.current_path || "unknown"}
Telemetry attention: ${lead.telemetry?.attention_score ?? "unknown"}
Hovered elements: ${(lead.telemetry?.hovered_elements || []).join(", ") || "none"}

Recent conversation:
${recentMessages || "No messages yet"}`;

    const result = await askGroq(prompt, {
      maxTokens: 800,
      temperature: 0.35,
      jsonMode: true,
    });

    const suggestions = result.success ? parseSuggestions(result.content) : [];
    return NextResponse.json({
      suggestions: suggestions.length > 0 ? suggestions : fallbackSuggestions(lead),
    });
  } catch (error) {
    console.error("[LeadSuggestions] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
