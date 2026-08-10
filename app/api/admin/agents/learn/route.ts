import { NextRequest, NextResponse } from "next/server";
import { selfLearningEngine, InteractionFeedback } from "@/lib/agents/SelfLearningEngine";
import { z } from "zod";

const feedbackSchema = z.object({
  agent_key: z.string(),
  user_message: z.string(),
  agent_response: z.string(),
  rating: z.enum(["positive", "negative", "neutral"]).optional(),
  feedback: z.string().max(1000).optional(),
  context: z.record(z.string(), z.any()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parseResult = feedbackSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: "Invalid feedback data", details: parseResult.error.message },
        { status: 400 }
      );
    }

    const feedback: InteractionFeedback = {
      interactionId: `interaction-${Date.now()}`,
      agentKey: parseResult.data.agent_key,
      userMessage: parseResult.data.user_message,
      agentResponse: parseResult.data.agent_response,
      rating: parseResult.data.rating,
      feedback: parseResult.data.feedback,
      context: parseResult.data.context,
    };

    const success = await selfLearningEngine.recordInteraction(feedback);

    return NextResponse.json({
      success,
      message: success ? "Feedback recorded successfully" : "Failed to record feedback",
    });
  } catch (error: any) {
    console.error("[LearnAPI] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentKey = searchParams.get("agent_key") || "prime";
    const action = searchParams.get("action") || "patterns";

    switch (action) {
      case "patterns": {
        const patterns = await selfLearningEngine.getLearnedPatterns(agentKey);
        return NextResponse.json({ success: true, data: patterns });
      }
      case "suggestions": {
        const suggestions = await selfLearningEngine.getImprovementSuggestions(agentKey);
        return NextResponse.json({ success: true, data: suggestions });
      }
      case "report": {
        const report = await selfLearningEngine.generateAgentReport(agentKey);
        return NextResponse.json({ success: true, data: report });
      }
      default:
        return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("[LearnAPI] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
