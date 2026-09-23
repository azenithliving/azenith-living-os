import { NextRequest, NextResponse } from "next/server";
import { agentOrchestrator, AgentType } from "@/lib/agents/AgentOrchestrator";
import { z } from "zod";

const chatSchema = z.object({
  agent_key: z.enum([
    "qayyim-core",
    "qayyim-cont",
    "qayyim-vis",
    "qayyim-seo",
    "qayyim-ux",
    "qayyim-ana",
    "qayyim-dev",
    "qayyim-qa",
    "prime",
    "vanguard",
    "analyst",
    "coder",
    "ops",
    "security",
    "learner",
    "auto",
  ]),
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

    const result = await agentOrchestrator.chat(agent_key as AgentType, message, {
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
    const [core, cont, vis, seo, ux, ana, dev, qa, vanguard, analyst, coder, ops, security, learner] = await Promise.all([
      agentOrchestrator.getAgentStatus("qayyim-core"),
      agentOrchestrator.getAgentStatus("qayyim-cont"),
      agentOrchestrator.getAgentStatus("qayyim-vis"),
      agentOrchestrator.getAgentStatus("qayyim-seo"),
      agentOrchestrator.getAgentStatus("qayyim-ux"),
      agentOrchestrator.getAgentStatus("qayyim-ana"),
      agentOrchestrator.getAgentStatus("qayyim-dev"),
      agentOrchestrator.getAgentStatus("qayyim-qa"),
      agentOrchestrator.getAgentStatus("vanguard"),
      agentOrchestrator.getAgentStatus("analyst"),
      agentOrchestrator.getAgentStatus("coder"),
      agentOrchestrator.getAgentStatus("ops"),
      agentOrchestrator.getAgentStatus("security"),
      agentOrchestrator.getAgentStatus("learner"),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        "qayyim-core": core,
        "qayyim-cont": cont,
        "qayyim-vis": vis,
        "qayyim-seo": seo,
        "qayyim-ux": ux,
        "qayyim-ana": ana,
        "qayyim-dev": dev,
        "qayyim-qa": qa,
        vanguard,
        analyst,
        coder,
        ops,
        security,
        learner,
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
