import { NextRequest, NextResponse } from "next/server";
import { agentOrchestrator, AgentType } from "@/lib/agents/AgentOrchestrator";
import { legacyToOps } from "@/lib/ops/identity";
import { z } from "zod";

const chatSchema = z.object({
  // A stale bundle or an old Telegram deep link can still post a retired key;
  // normalising here keeps one key set in the database instead of two.
  agent_key: z.preprocess((k) => legacyToOps(String(k)), z.enum([
    "ops-lead",
    "ops-content",
    "ops-visual",
    "ops-seo",
    "ops-ux",
    "ops-analytics",
    "ops-dev",
    "ops-qa",
    "prime",
    "vanguard",
    "analyst",
    "coder",
    "ops",
    "security",
    "learner",
    "auto",
  ])),
  message: z.string().min(1).max(4000),
  context: z.record(z.string(), z.any()).optional(),
  session_id: z.string().optional(),
  /** P6-M6: a command-palette click names its tool. Whitelisted downstream by
   * `explicitIntent` — anything invented here is refused, never executed. */
  run_tool: z.string().max(80).optional(),
  run_params: z.record(z.string(), z.any()).optional(),
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

    const { agent_key, message, context, session_id, run_tool, run_params } = parseResult.data;

    const result = await agentOrchestrator.chat(agent_key as AgentType, message, {
      ...context,
      session_id,
      run_tool,
      run_params,
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
      agentOrchestrator.getAgentStatus("ops-lead"),
      agentOrchestrator.getAgentStatus("ops-content"),
      agentOrchestrator.getAgentStatus("ops-visual"),
      agentOrchestrator.getAgentStatus("ops-seo"),
      agentOrchestrator.getAgentStatus("ops-ux"),
      agentOrchestrator.getAgentStatus("ops-analytics"),
      agentOrchestrator.getAgentStatus("ops-dev"),
      agentOrchestrator.getAgentStatus("ops-qa"),
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
        "ops-lead": core,
        "ops-content": cont,
        "ops-visual": vis,
        "ops-seo": seo,
        "ops-ux": ux,
        "ops-analytics": ana,
        "ops-dev": dev,
        "ops-qa": qa,
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
