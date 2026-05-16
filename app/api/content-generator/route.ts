import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimiter, getClientIP } from "@/lib/rate-limit";
import { generateAIContent, improveContent } from "@/lib/ai-content";

export async function POST(request: NextRequest) {
  try {
    if (rateLimiter) {
      const ip = getClientIP(request);
      const rate = await checkRateLimit(rateLimiter, ip);
      if (!rate.success && rate.limit !== undefined && rate.reset !== undefined) {
        return NextResponse.json(
          {
            ok: false,
            error: "Rate limit exceeded",
            limit: rate.limit,
            remaining: 0,
            reset: rate.reset,
          },
          { status: 429 }
        );
      }
    }

    const body = await request.json();
    const { type, context, tone = "luxury", language = "ar", improve } = body;

    if (improve && body.content) {
      const result = await improveContent(body.content, improve, language);
      return NextResponse.json({
        ok: true,
        content: result.content,
        tokensUsed: result.tokensUsed,
        source: result.source,
      });
    }

    const result = await generateAIContent({
      type,
      context,
      tone,
      language,
    });

    return NextResponse.json({
      ok: true,
      content: result.content,
      alternatives: result.alternatives,
      tokensUsed: result.tokensUsed,
      source: result.source,
    });
  } catch (error) {
    console.error("Content generation error:", error);
    return NextResponse.json(
      { ok: false, message: "Failed to generate content" },
      { status: 500 }
    );
  }
}
