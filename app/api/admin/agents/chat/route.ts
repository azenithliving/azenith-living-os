import { NextRequest, NextResponse } from "next/server";
import { agentOrchestrator } from "@/lib/agents/AgentOrchestrator";
import { z } from "zod";

const chatSchema = z.object({
  agent_key: z.enum(["prime", "vanguard", "auto"]),
  message: z.string().min(1).max(4000),
  context: z.record(z.string(), z.any()).optional(),
  session_id: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parseResult = chatSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request", details: parseResult.error.message },
        { status: 400 }
      );
    }

    const { agent_key, message, context, session_id } = parseResult.data;

    const result = await agentOrchestrator.chat(agent_key, message, {
      ...context,
      session_id,
    });

    await agentOrchestrator.logEvent(
      "chat_interaction",
      result.agentUsed,
      {
        inputLength: message.length,
        outputLength: result.response.length,
        success: result.success,
      }
    );

    return NextResponse.json({
      success: result.success,
      data: {
        agent: result.agentUsed,
        message: result.response,
        metadata: result.metadata,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[AgentChatAPI] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const [primeStatus, vanguardStatus] = await Promise.all([
      agentOrchestrator.getAgentStatus("prime"),
      agentOrchestrator.getAgentStatus("vanguard"),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        prime: primeStatus,
        vanguard: vanguardStatus,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[AgentChatAPI] Status error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get agent status" },
      { status: 500 }
    );
  }
}
