import { NextRequest, NextResponse } from "next/server";
import { askOpenRouter } from "@/lib/ai-orchestrator";

export async function POST(request: NextRequest) {
  try {
    const { prompt, imageUrl, options } = await request.json();

    if (!prompt || !imageUrl) {
      return NextResponse.json({ error: "Missing prompt or imageUrl" }, { status: 400 });
    }

    const result = await askOpenRouter(prompt, imageUrl, options);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[AI Vision API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
