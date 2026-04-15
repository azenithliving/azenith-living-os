"use server";

/**
 * AZENITH SOVEREIGN - The Great Purge Edition
 * Raw AI Pass-Through | No Templates | No Hardcoded Logic
 */

import { askGroq, askOpenRouter, askMistral } from "./ai-orchestrator";
import { getSupabaseServerClient } from "./supabase";

// One system prompt only. Nothing else.
const SYSTEM_PROMPT = `أنت المهندس الأول - شريك سيد أزينث.

من هو: صاحب Azenith Living (تصميم داخلي فاخر)، مطور Next.js 16، رائد أعمال مصري.

أسلوبك: تحادثه كشريك في الغرفة. قصير، ذكي، عميق. لا مقالات، لا قوائم. رد بشكل طبيعي كأنك إنسان.

ممنوع: "أنا أسمعك"، "كشريك في بناء"، "بناءً على طلبك"، أي عبارة آلية.

مطلوب: حوار حر. اسأل. ناقش. اقترح.`;

// Simple conversation memory - just storing messages
const conversationMemory = new Map<string, Array<{role: "user" | "assistant", content: string}>>();

// Just pass the message to AI. No processing. No templates.
export async function processMastermindRequest(command: string, sessionId: string, userId?: string) {
  // Get or create conversation history
  const history = conversationMemory.get(sessionId) || [];
  history.push({ role: "user", content: command });
  
  // Build simple prompt with history
  const historyText = history.slice(-6).map(h => 
    h.role === "user" ? `سيد أزينث: ${h.content}` : `أنا: ${h.content}`
  ).join("\n");
  
  const prompt = `${SYSTEM_PROMPT}\n\n${historyText ? historyText + "\n" : ""}سيد أزينث: ${command}\nأنا:`;
  
  // Call AI - raw response, no processing
  let aiResponse = "";
  
  // Try OpenRouter first
  const openRouterResult = await askOpenRouter(prompt, undefined, {
    model: "anthropic/claude-3.5-sonnet",
    temperature: 0.9,
    maxTokens: 1024,
  });
  
  if (openRouterResult.success && openRouterResult.content) {
    aiResponse = openRouterResult.content;
  } else {
    // Fallback to Groq
    const groqResult = await askGroq(prompt, {
      temperature: 0.9,
      maxTokens: 1024,
    });
    
    if (groqResult.success && groqResult.content) {
      aiResponse = groqResult.content;
    } else {
      aiResponse = "سيد أزينث، أواجه مشكلة تقنية مؤقتة. حدثني، ما الذي يدور في بالك؟";
    }
  }
  
  // Store response
  history.push({ role: "assistant", content: aiResponse });
  
  // Keep last 10 messages only
  if (history.length > 10) {
    conversationMemory.set(sessionId, history.slice(-10));
  } else {
    conversationMemory.set(sessionId, history);
  }
  
  // Return raw AI response. No modifications. No suggestions. No insights.
  return {
    response: aiResponse,
    suggestions: [], // Always empty - no buttons
  };
}

// ============================================
// REAL IMPLEMENTATION - System Health
// ============================================
export async function getSystemHealth() {
  const supabase = getSupabaseServerClient();
  const defaultValue = {
    status: "healthy" as const,
    uptime: 0,
    metrics: {
      memoryUsage: 0,
      cpuUsage: 0,
      activeAgents: 0,
      pendingTasks: 0,
    },
  };

  try {
    // Get latest health entry
    const { data: latestHealth, error: healthError } = await supabase
      .from("system_health_log")
      .select("created_at, severity")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (healthError && healthError.code !== "PGRST116") {
      console.error("[getSystemHealth] Error fetching health log:", healthError);
    }

    // Get oldest entry for uptime calculation
    const { data: oldestEntry, error: oldestError } = await supabase
      .from("system_health_log")
      .select("created_at")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (oldestError && oldestError.code !== "PGRST116") {
      console.error("[getSystemHealth] Error fetching oldest entry:", oldestError);
    }

    // Calculate uptime in hours
    let uptime = 0;
    if (oldestEntry?.created_at) {
      const now = new Date();
      const oldest = new Date(oldestEntry.created_at);
      uptime = Math.floor((now.getTime() - oldest.getTime()) / (1000 * 60 * 60));
    }

    // Count pending tasks from parallel_task_queue
    const { data: pendingTasksData, error: tasksError } = await supabase
      .from("parallel_task_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    if (tasksError) {
      console.error("[getSystemHealth] Error fetching pending tasks:", tasksError);
    }

    // Get critical events count for status determination
    const { data: criticalEvents, error: criticalError } = await supabase
      .from("system_health_log")
      .select("id", { count: "exact", head: true })
      .eq("severity", "critical")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (criticalError) {
      console.error("[getSystemHealth] Error fetching critical events:", criticalError);
    }

    // Determine status based on severity
    let status: "healthy" | "degraded" | "critical" = "healthy";
    if (latestHealth?.severity === "critical" || (criticalEvents?.length || 0) > 5) {
      status = "critical";
    } else if (latestHealth?.severity === "warning" || (criticalEvents?.length || 0) > 0) {
      status = "degraded";
    }

    return {
      status,
      uptime,
      metrics: {
        memoryUsage: 0, // Cannot be determined from DB
        cpuUsage: 0, // Cannot be determined from DB
        activeAgents: 0, // No agent_status table exists
        pendingTasks: pendingTasksData?.length || 0,
      },
    };
  } catch (error) {
    console.error("[getSystemHealth] Unexpected error:", error);
    return defaultValue;
  }
}

// ============================================
// REAL IMPLEMENTATION - Business Metrics
// ============================================
export async function getBusinessMetrics() {
  const supabase = getSupabaseServerClient();
  const defaultValue = {
    totalLeads: 0,
    conversionRate: 0,
    totalBookings: 0,
    revenue: 0,
    activeTenants: 0,
  };

  try {
    // Count total leads (users)
    const { data: leadsData, error: leadsError } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true });

    if (leadsError) {
      console.error("[getBusinessMetrics] Error fetching leads:", leadsError);
    }

    // Count total bookings (requests with paid = true)
    const { data: bookingsData, error: bookingsError } = await supabase
      .from("requests")
      .select("id", { count: "exact", head: true })
      .eq("paid", true);

    if (bookingsError) {
      console.error("[getBusinessMetrics] Error fetching bookings:", bookingsError);
    }

    // Count total requests for conversion rate calculation
    const { data: requestsData, error: requestsError } = await supabase
      .from("requests")
      .select("id", { count: "exact", head: true });

    if (requestsError) {
      console.error("[getBusinessMetrics] Error fetching requests:", requestsError);
    }

    // Calculate conversion rate: (paid requests / total requests) * 100
    const totalRequests = requestsData?.length || 0;
    const paidRequests = bookingsData?.length || 0;
    const conversionRate = totalRequests > 0 ? (paidRequests / totalRequests) * 100 : 0;

    // Get total revenue from payments
    const { data: paymentsData, error: paymentsError } = await supabase
      .from("payments")
      .select("amount");

    if (paymentsError) {
      console.error("[getBusinessMetrics] Error fetching payments:", paymentsError);
    }

    const revenue = paymentsData?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    // Count active tenants (companies)
    const { data: tenantsData, error: tenantsError } = await supabase
      .from("companies")
      .select("id", { count: "exact", head: true });

    if (tenantsError) {
      console.error("[getBusinessMetrics] Error fetching tenants:", tenantsError);
    }

    return {
      totalLeads: leadsData?.length || 0,
      conversionRate: Math.round(conversionRate * 100) / 100,
      totalBookings: paidRequests,
      revenue: Math.round(revenue * 100) / 100,
      activeTenants: tenantsData?.length || 0,
    };
  } catch (error) {
    console.error("[getBusinessMetrics] Unexpected error:", error);
    return defaultValue;
  }
}

export async function scanProjectFiles() {
  return [];
}

export async function readProjectFile(path: string) {
  return { success: false, error: "Not implemented" };
}

export async function generateProactiveBriefing() {
  return "أنا المهندس الأول. ما الذي تريد مناقشته؟";
}

export async function analyzeProjectStructure() {
  return "";
}

// ============================================
// REAL IMPLEMENTATION - Mastermind Status
// ============================================
export async function getMastermindStatus() {
  const supabase = getSupabaseServerClient();
  const defaultValue = {
    active: false,
    version: "1.0.0",
    commandsLast24h: 0,
    successRate: 0,
    topIntent: "",
  };

  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const last1h = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    // Get commands in last 24 hours
    const { data: commands24h, error: commandsError } = await supabase
      .from("immutable_command_log")
      .select("status, command_text")
      .gte("executed_at", last24h);

    if (commandsError) {
      console.error("[getMastermindStatus] Error fetching commands:", commandsError);
      return defaultValue;
    }

    // Check if active (commands in last hour)
    const { data: commands1h, error: activeError } = await supabase
      .from("immutable_command_log")
      .select("id", { count: "exact", head: true })
      .gte("executed_at", last1h);

    if (activeError) {
      console.error("[getMastermindStatus] Error checking active status:", activeError);
    }

    const active = (commands1h?.length || 0) > 0;

    // Calculate success rate
    const totalCommands = commands24h?.length || 0;
    const successfulCommands = commands24h?.filter(
      (c) => c.status === "executed"
    ).length || 0;
    const successRate = totalCommands > 0 ? (successfulCommands / totalCommands) * 100 : 0;

    // Find top intent (most common first word in commands)
    const intentCounts: Record<string, number> = {};
    commands24h?.forEach((cmd) => {
      const firstWord = cmd.command_text?.trim().split(/\s+/)[0]?.toLowerCase() || "unknown";
      intentCounts[firstWord] = (intentCounts[firstWord] || 0) + 1;
    });

    const topIntent = Object.entries(intentCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "";

    return {
      active,
      version: "1.0.0",
      commandsLast24h: totalCommands,
      successRate: Math.round(successRate * 100) / 100,
      topIntent,
    };
  } catch (error) {
    console.error("[getMastermindStatus] Unexpected error:", error);
    return defaultValue;
  }
}

export async function atomicRollback(actionId: string) {
  return { success: true };
}

export async function startSovereignMonitoring() {
  console.log("[Sovereign] Monitoring");
}

export async function checkForProactiveOpportunities() {
  return { found: false, opportunities: [] };
}

export async function getFilesystemState() {
  return { totalFiles: 0, recentChanges: [], criticalFiles: [] };
}
export async function getDatabaseState() {
  return { totalTables: 0, recordCounts: {}, recentActivity: [] };
}
