import { NextRequest, NextResponse } from "next/server";
import { askWithFloor } from "@/lib/ai-orchestrator";
import { requireAdminApi } from "@/lib/admin-api-guard";
import { answeredByLabel } from "@/lib/ops/key-desk";

interface LeadContext {
  name?: string;
  roomType?: string;
  budget?: string;
  location?: string;
  summary?: string;
  messages?: Array<{ role: string; content: string }>;
}

function fallbackTemplate(lead: LeadContext): string {
  const room = lead.roomType && lead.roomType !== "غير محدد" ? lead.roomType : "مشروع حضرتك";
  return `أهلا بحضرتك، معك فريق أزينث ليفينج. كنا بنتابع اهتمامك بخصوص ${room}، ونقدر نساعدك بخطوة واضحة تناسب المساحة والستايل المطلوب. تحب نرتب مكالمة قصيرة مع مستشار متخصص؟`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { unauthorized } = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const lead = (await request.json()) as LeadContext;
    const recentMessages = (lead.messages || [])
      .slice(-10)
      .map((message) => `${message.role}: ${message.content}`)
      .join("\n");

    const prompt = `Write one WhatsApp follow-up message for a dormant Azenith Living lead.

Rules:
- Egyptian Arabic unless conversation is clearly English.
- Warm, premium, concise.
- No fake discounts, false urgency, exact prices, or invented timelines.
- One clear next step.
- Return only the message text.

Lead:
Name: ${lead.name || "unknown"}
Project: ${lead.roomType || "unknown"}
Budget: ${lead.budget || "unknown"}
Location: ${lead.location || "unknown"}
Summary: ${lead.summary || "none"}

Recent conversation:
${recentMessages || "No messages yet"}`;

    const answer = await askWithFloor("follow-up", [{ role: "user", content: prompt }], {
      maxTokens: 400,
      temperature: 0.35,
    });

    const template = answer.ok && answer.content.trim()
      ? answer.content.trim().replace(/^["']|["']$/g, "")
      : fallbackTemplate(lead);

    return NextResponse.json({
      template,
      answered_by: answer.ok ? answeredByLabel(answer.provider) : "قالب المحل — من غير مفتاح",
      note: answer.ok ? null : answer.floorLine,
    });
  } catch (error) {
    // The follow-up is the one thing that must not go blank: the template it always could
    // send is sent, and the reason the model stayed out is said in his language.
    console.error("[LeadFollowUp] Error:", error);
    return NextResponse.json({
      template: fallbackTemplate({} as LeadContext),
      answered_by: "قالب المحل — من غير مفتاح",
      note: "الباب ما قدرش يوصل للنموذج — الرسالة اللي ظاهرة قالب ثابت.",
    });
  }
}
