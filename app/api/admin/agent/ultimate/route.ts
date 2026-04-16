/**
 * Ultimate Agent API Route
 *
 * REST API endpoint for the Ultimate Intelligence Agent
 * Handles commands, queries, and real-time interactions
 */

import { NextRequest, NextResponse } from "next/server";
import {
  initializeAgent,
  executeCommand,
  processAIRequest,
  getAgentStatus,
  getAgentConfig,
  updateAgentConfig,
  runProactiveCheck,
  getPendingApprovals,
  handleApproval,
  generateDailyReport,
  getMetricsSnapshot,
  detectAnomalies,
  generateOpportunities,
  generateStrategicRecommendations,
  getActiveGoals,
  getSecurityStats,
  getMemoryStats,
  executeAction,
  UltimateAgent,
} from "@/lib/ultimate-agent";
import { supabaseService } from "@/lib/supabase-service";

// Initialize agent on first request
let agentInitialized = false;

async function ensureInitialized() {
  if (!agentInitialized) {
    await initializeAgent();
    agentInitialized = true;
  }
}

// Authentication helper using supabaseService
async function authenticate(request: NextRequest): Promise<{ authenticated: boolean; user?: string; role?: string }> {
  const { data: { user } } = await supabaseService.auth.getUser();
  
  if (!user) {
    return { authenticated: false };
  }
  
  // Check if user is admin
  const { data: profile } = await supabaseService
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  
  const isAdmin = profile?.role === "admin" || user.email?.endsWith("@azenithliving.com");
  
  return {
    authenticated: true,
    user: user.email || user.id,
    role: isAdmin ? "admin" : "user",
  };
}

// GET handler - Status, Reports, Data queries
export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  await ensureInitialized();
  
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "status";
  
  try {
    switch (action) {
      case "status":
        const status = await getAgentStatus();
        return NextResponse.json({ success: true, status });
        
      case "config":
        const config = getAgentConfig();
        return NextResponse.json({ success: true, config });
        
      case "approvals":
        const { success, requests, error } = await getPendingApprovals();
        return NextResponse.json({ success, requests, error });
        
      case "metrics":
        const metricsResult = await getMetricsSnapshot();
        return NextResponse.json(metricsResult);
        
      case "anomalies":
        const anomaliesResult = await detectAnomalies();
        return NextResponse.json(anomaliesResult);
        
      case "opportunities":
        const opportunitiesResult = await generateOpportunities();
        return NextResponse.json(opportunitiesResult);
        
      case "recommendations":
        const recommendationsResult = await generateStrategicRecommendations();
        return NextResponse.json(recommendationsResult);
        
      case "goals":
        const goalsResult = await getActiveGoals();
        return NextResponse.json(goalsResult);
        
      case "security":
        const securityResult = await getSecurityStats();
        return NextResponse.json(securityResult);
        
      case "memory":
        const memoryResult = await getMemoryStats();
        return NextResponse.json(memoryResult);
        
      case "report":
        const reportResult = await generateDailyReport();
        return NextResponse.json(reportResult);
        
      default:
        return NextResponse.json(
          { success: false, error: "Unknown action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[UltimateAgentAPI] GET error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST handler - Commands, Actions, Updates
export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`[UltimateAgentAPI] [${requestId}] ===== NEW REQUEST =====`);
  console.log(`[UltimateAgentAPI] [${requestId}] URL: ${request.url}`);
  console.log(`[UltimateAgentAPI] [${requestId}] Method: ${request.method}`);
  
  const auth = await authenticate(request);
  
  console.log(`[UltimateAgentAPI] [${requestId}] Auth result:`, { authenticated: auth.authenticated, user: auth.user, role: auth.role });
  
  if (!auth.authenticated) {
    console.error(`[UltimateAgentAPI] [${requestId}] AUTH FAILED - Unauthorized`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  await ensureInitialized();
  
  try {
    const body = await request.json();
    const { type, payload } = body;
    
    console.log(`[UltimateAgentAPI] [${requestId}] Request body:`, JSON.stringify(body, null, 2));
    
    switch (type) {
      case "command":
        const { command, context } = payload || {};
        if (!command) {
          return NextResponse.json(
            { success: false, error: "Command is required" },
            { status: 400 }
          );
        }
        const commandResult = await executeCommand(command, context);
        return NextResponse.json(commandResult);
        
      case "ai_request":
        const { request, context: aiContext } = payload || {};
        if (!request) {
          return NextResponse.json(
            { success: false, error: "Request is required" },
            { status: 400 }
          );
        }
        const aiResult = await processAIRequest(request, aiContext);
        return NextResponse.json(aiResult);
        
      case "execute_action":
        // Only admins can execute actions
        if (auth.role !== "admin") {
          return NextResponse.json(
            { success: false, error: "Admin access required" },
            { status: 403 }
          );
        }
        const { actionType, actionPayload } = payload || {};
        const actionResult = await executeAction(actionType, actionPayload);
        return NextResponse.json(actionResult);
        
      case "update_config":
        if (auth.role !== "admin") {
          return NextResponse.json(
            { success: false, error: "Admin access required" },
            { status: 403 }
          );
        }
        const { updates } = payload || {};
        const configResult = await updateAgentConfig(updates);
        return NextResponse.json(configResult);
        
      case "handle_approval":
        const { requestId, approved, reason } = payload || {};
        if (!requestId || approved === undefined) {
          return NextResponse.json(
            { success: false, error: "requestId and approved are required" },
            { status: 400 }
          );
        }
        const approvalResult = await handleApproval(
          requestId,
          approved,
          auth.user || "unknown",
          reason
        );
        return NextResponse.json(approvalResult);
        
      case "proactive_check":
        if (auth.role !== "admin") {
          return NextResponse.json(
            { success: false, error: "Admin access required" },
            { status: 403 }
          );
        }
        const checkResult = await runProactiveCheck();
        return NextResponse.json(checkResult);
        
      case "process_message":
        // UltimateAgent Phase 1: Natural language command processing
        console.log(`[UltimateAgentAPI] [${requestId}] Processing message: "${payload?.message}"`);
        const { message } = payload || {};
        if (!message) {
          console.error(`[UltimateAgentAPI] [${requestId}] Missing message in payload`);
          return NextResponse.json(
            { success: false, error: "Message is required" },
            { status: 400 }
          );
        }
        console.log(`[UltimateAgentAPI] [${requestId}] Creating UltimateAgent instance...`);
        const agent = new UltimateAgent();
        console.log(`[UltimateAgentAPI] [${requestId}] Calling processCommand...`);
        const reply = await agent.processCommand(message, auth.user || "unknown");
        console.log(`[UltimateAgentAPI] [${requestId}] processCommand returned: "${reply}"`);
        console.log(`[UltimateAgentAPI] [${requestId}] ===== REQUEST COMPLETED =====`);
        return NextResponse.json({ success: true, reply });
        
      default:
        return NextResponse.json(
          { success: false, error: `Unknown type: ${type}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error(`[UltimateAgentAPI] [${requestId}] ===== UNHANDLED ERROR =====`);
    console.error(`[UltimateAgentAPI] [${requestId}] Error type:`, error?.constructor?.name);
    console.error(`[UltimateAgentAPI] [${requestId}] Error message:`, error instanceof Error ? error.message : "Unknown error");
    console.error(`[UltimateAgentAPI] [${requestId}] Error stack:`, error instanceof Error ? error.stack : "No stack");
    console.error(`[UltimateAgentAPI] [${requestId}] ===== END ERROR =====`);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error", requestId },
      { status: 500 }
    );
  }
}

// WebSocket-like real-time updates via SSE (Server-Sent Events)
export async function streamUpdates(request: NextRequest) {
  const auth = await authenticate(request);
  
  if (!auth.authenticated) {
    return new Response("Unauthorized", { status: 401 });
  }
  
  const stream = new ReadableStream({
    start(controller) {
      // Send initial data
      const sendUpdate = async () => {
        try {
          const status = await getAgentStatus();
          const { requests } = await getPendingApprovals();
          
          const data = JSON.stringify({
            timestamp: Date.now(),
            status,
            pendingApprovals: requests?.length || 0,
          });
          
          controller.enqueue(`data: ${data}\n\n`);
        } catch (error) {
          controller.error(error);
        }
      };
      
      // Send update every 30 seconds
      const interval = setInterval(sendUpdate, 30000);
      
      // Cleanup on close
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
      
      // Send initial update
      sendUpdate();
    },
  });
  
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
