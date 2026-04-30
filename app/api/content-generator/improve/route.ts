import { NextRequest, NextResponse } from "next/server";

import { improveContent } from "@/lib/ai-content";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, improvement } = body;

    const result = await improveContent(content, improvement);

    return NextResponse.json({
      ok: true,
      content: result.content,
      tokensUsed: result.tokensUsed
    });
  } catch (error) {
    console.error("Content improvement error:", error);
    return NextResponse.json(
      { ok: false, message: "Failed to improve content" },
      { status: 500 }
    );
  }
}