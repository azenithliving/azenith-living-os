import { NextRequest, NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { generateAIContent, improveContent } from "@/lib/ai-content";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, context, tone = "luxury", language = "ar" } = body;

    const result = await generateAIContent({
      type,
      context,
      tone,
      language
    });

    return NextResponse.json({
      ok: true,
      content: result.content,
      alternatives: result.alternatives,
      tokensUsed: result.tokensUsed
    });
  } catch (error) {
    console.error("Content generation error:", error);
    return NextResponse.json(
      { ok: false, message: "Failed to generate content" },
      { status: 500 }
    );
  }
}