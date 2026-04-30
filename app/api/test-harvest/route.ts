/**
 * API Route: /api/test-harvest
 * Test endpoint for AI Orchestrator - Groq API validation
 */

import { NextRequest, NextResponse } from "next/server";
import { aiOrchestrator } from "@/lib/ai-orchestrator";

export async function GET(request: NextRequest) {
  console.log("\n🔥 AI Orchestrator Test API triggered");

  try {
    // Check API key status
    const keyStatus = aiOrchestrator.getKeyStatus();

    // Test Groq API with a simple prompt
    const testPrompt = "Say 'Azenith Living AI is active' and list 3 luxury interior design keywords.";
    const groqResult = await aiOrchestrator.fastText(testPrompt);

    return NextResponse.json({
      success: groqResult.success,
      keyStatus: {
        groq: keyStatus.groqConfigured,
        openRouter: keyStatus.openRouterConfigured,
        mistral: keyStatus.mistralConfigured,
      },
      groqTest: {
        success: groqResult.success,
        content: groqResult.content,
        error: groqResult.error,
      },
      timestamp: new Date().toISOString(),
    }, {
      status: groqResult.success ? 200 : 500,
    });
  } catch (error) {
    console.error("❌ AI Orchestrator test failed:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
