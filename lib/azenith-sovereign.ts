"use server";

/**
 * AZENITH SOVEREIGN - The Great Purge Edition
 * Raw AI Pass-Through | No Templates | No Hardcoded Logic
 */

import { askGroq, askOpenRouter, askMistral } from "./ai-orchestrator";

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

// Stub functions for compatibility
export async function getSystemHealth() {
  return { providers: {}, cacheEfficiency: {}, systemHealth: {} };
}

export async function getBusinessMetrics() {
  return { websiteTraffic: 0, conversionRate: 0, activeProjects: 0, pendingTasks: 0, lastDeployment: "", vercelStatus: "", supabaseStatus: "" };
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

export async function getMastermindStatus() {
  return { awareness: {}, arsenal: {}, tripleA: {}, soul: {}, business: {} };
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
