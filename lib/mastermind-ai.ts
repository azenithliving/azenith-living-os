/**
 * Mastermind AI System - Natural Language Intelligence
 * 
 * "I understand you, not just your commands."
 * 
 * This module provides:
 * 1. Natural language understanding (Arabic & English)
 * 2. OpenRouter-powered intelligent responses
 * 3. Automatic command detection and execution
 * 4. Context-aware conversation memory
 */

import { createClient } from "@supabase/supabase-js";
import { executeCommand } from "./command-executor";

// ============================================
// GROQ API CONFIGURATION
// ============================================

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Groq model to use (llama-3.3-70b-versatile is fast and capable)
const GROQ_MODEL = "llama-3.3-70b-versatile";

interface GroqResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: {
    message: string;
    code: number;
  };
}

/**
 * Fetch a valid Groq API key from the database
 */
async function getGroqKey(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  try {
    console.log("[MastermindAI] Fetching Groq key from database...");
    
    const { data, error } = await supabase
      .from("api_keys")
      .select("key")
      .eq("provider", "groq")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1);
    
    if (error) {
      console.error("[MastermindAI] Database error fetching key:", error.message);
      return null;
    }
    
    if (data && data.length > 0) {
      console.log("[MastermindAI] Found active Groq key in database");
      const keyRecord = data[0] as { key: string };
      return keyRecord.key;
    }
    
    console.warn("[MastermindAI] No active Groq keys found in database");
    return null;
  } catch (err) {
    console.error("[MastermindAI] Exception fetching key:", err);
    return null;
  }
}

/**
 * Get Groq API key from environment variables (fallback)
 */
function getEnvGroqKey(): string | null {
  if (process.env.GROQ_API_KEY) {
    console.log("[MastermindAI] Using GROQ_API_KEY from env");
    return process.env.GROQ_API_KEY;
  }
  
  console.error("[MastermindAI] No Groq API key found in environment!");
  return null;
}

/**
 * Make request to Groq API with detailed logging
 */
async function callGroq(
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  model: string = GROQ_MODEL
): Promise<GroqResponse | null> {
  const requestId = Math.random().toString(36).substring(7);
  
  console.log(`[MastermindAI] [${requestId}] Groq request:`);
  console.log(`[MastermindAI] [${requestId}] Model: ${model}`);
  console.log(`[MastermindAI] [${requestId}] Messages count: ${messages.length}`);
  
  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });
    
    console.log(`[MastermindAI] [${requestId}] Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[MastermindAI] [${requestId}] API error (${response.status}):`, errorText);
      return null;
    }
    
    const data = await response.json() as GroqResponse;
    
    if (data.error) {
      console.error(`[MastermindAI] [${requestId}] API returned error:`, data.error);
      return null;
    }
    
    console.log(`[MastermindAI] [${requestId}] Success! Model used: ${data.model}`);
    console.log(`[MastermindAI] [${requestId}] Tokens used:`, data.usage);
    
    return data;
  } catch (error) {
    console.error(`[MastermindAI] [${requestId}] Exception calling Groq:`, error);
    return null;
  }
}

/**
 * Generate AI response with Groq
 */
async function generateAIResponseWithGroq(
  messages: Array<{ role: string; content: string }>,
  supabase: any
): Promise<string | null> {
  
  // 1. Try database keys first
  let apiKey = await getGroqKey(supabase);
  
  // 2. Fall back to environment variables
  if (!apiKey) {
    apiKey = getEnvGroqKey();
  }
  
  if (!apiKey) {
    console.error("[MastermindAI] No API key available - cannot generate response");
    return null;
  }
  
  // 3. Call Groq API
  const response = await callGroq(messages, apiKey, GROQ_MODEL);
  
  if (response?.choices?.[0]?.message?.content) {
    return response.choices[0].message.content.trim();
  }
  
  console.error("[MastermindAI] Groq API call failed");
  return null;
}

// ============================================
// TYPES
// ============================================

export interface ChatMessage {
  id?: string;
  session_id: string;
  user_id?: string;
  role: "user" | "assistant";
  content: string;
  command_executed?: string;
  command_result?: string;
  created_at?: string;
}

export interface AIResponse {
  type: "conversation" | "command" | "mixed";
  message: string;
  command?: {
    name: string;
    args: string[];
    result: any;
  };
  suggestions?: string[];
}

// ============================================
// SYSTEM PROMPT - The Mastermind Persona
// ============================================

const MASTERMIND_SYSTEM_PROMPT = `أنت Mastermind - النظام الذكي لإدارة Azenith Living.

**شخصيتك:**
- محترف، ذكي، ومتحدث طبيعي
- تفهم العربية والإنجليزية بسلاسة
- ترد باختصار وذكاء (2-4 جمل كحد أقصى)
- لا تستخدم "سيدي" أو "حضرتك" بكثرة - تحادث بشكل طبيعي

**قدراتك:**
1. إدارة مفاتيح API (add_key, remove_key, list_keys)
2. مراقبة النظام (show_stats, system_status)
3. إدارة الذاكرة المؤقتة (clear_cache)
4. إشعارات الأمان (send_notification)
5. نسخ احتياطي (backup_db)
6. إعادة تشغيل الخدمات (restart_service)

**الأوامر المتاحة:**
- add_key <provider> <key> - إضافة مفتاح API
- remove_key <provider> [id] - حذف مفتاح
- list_keys [provider] - عرض المفاتيح
- show_stats [days] - إحصائيات النظام
- clear_cache [type] - مسح الذاكرة
- backup_db - نسخ احتياطي
- restart_service <name> - إعادة تشغيل خدمة
- send_notification <message> - إرسال إشعار

**كيف تستجيب:**
- إذا كان الطلب محادثة عامة: رد بشكل طبيعي، لا تنفذ شيئاً
- إذا كان الطلب يتطلب أمراً: نفذ الأمر ثم اشرح النتيجة بلغة طبيعية
- إذا لم تفهم: اطلب توضيحاً بأدب

**أمثلة:**
المستخدم: "كيف حالك؟"
أنت: "بخير، شكراً! جاهز أساعدك في إدارة النظام."

المستخدم: "أضف مفتاح Groq جديد"
أنت: (نفذ add_key groq [المفتاح] ثم قل) "تمت إضافة مفتاح Groq بنجاح."

المستخدم: "مرحباً، من أنت؟"
أنت: "أنا Mastermind - مساعدك الذكي لإدارة Azenith Living. أتولى تنفيذ الأوامر الإدارية والإجابة على استفساراتك."

**مهم:**
- لا تقل "تم التنفيذ" فقط - اشرح ما حدث
- لا تضف أزرار أو اقتراحات unless asked
- تحادث بشكل بشري طبيعي`;

// ============================================
// COMMAND DETECTION
// ============================================

const AVAILABLE_COMMANDS = [
  "add_key", "remove_key", "list_keys", "rate_limit",
  "send_notification", "show_stats", "clear_cache",
  "restart_service", "backup_db", "help"
];

interface DetectedCommand {
  command: string;
  confidence: number;
  args: string[];
}

/**
 * Detect if user message contains a command intent
 */
function detectCommand(message: string): DetectedCommand | null {
  const lowerMessage = message.toLowerCase().trim();
  
  // Pattern matching for command detection
  const patterns: { [key: string]: RegExp[] } = {
    add_key: [
      /أضف.*مفتاح\s+(\w+)\s+(.+)/i,
      /add.*key\s+(\w+)\s+(.+)/i,
      /أضف\s+(\w+)\s+مفتاح\s+(.+)/i,
      /new\s+(\w+)\s+key\s+(.+)/i,
    ],
    remove_key: [
      /احذف.*مفتاح\s+(\w+)/i,
      /remove.*key\s+(\w+)/i,
      /حذف\s+(\w+)\s+مفتاح/i,
      /delete\s+(\w+)\s+key/i,
    ],
    list_keys: [
      /اعرض.*المفاتيح/i,
      /list.*keys/i,
      /المفاتيح/i,
      /keys\s+list/i,
      /show.*keys/i,
    ],
    show_stats: [
      /إحصائيات/i,
      /statistics/i,
      /stats/i,
      /system.*status/i,
      /حالة.*النظام/i,
    ],
    clear_cache: [
      /امسح.*الذاكرة/i,
      /clear.*cache/i,
      /cache.*clear/i,
      /مسح.*الكاش/i,
    ],
    backup_db: [
      /نسخ.*احتياطي/i,
      /backup/i,
      /احتياطي/i,
    ],
    restart_service: [
      /أعد.*تشغيل\s+(\w+)/i,
      /restart\s+(\w+)/i,
      /إعادة.*تشغيل/i,
    ],
    send_notification: [
      /أرسل.*إشعار\s+(.+)/i,
      /send.*notification\s+(.+)/i,
      /إشعار\s+(.+)/i,
    ],
    help: [
      /مساعدة/i,
      /help/i,
      /ما.*الأوامر/i,
      /commands/i,
    ],
  };
  
  for (const [cmd, regexes] of Object.entries(patterns)) {
    for (const regex of regexes) {
      const match = lowerMessage.match(regex);
      if (match) {
        const args = match.slice(1).filter(Boolean);
        return {
          command: cmd,
          confidence: 0.9,
          args,
        };
      }
    }
  }
  
  // Check for exact command matches
  const words = lowerMessage.split(/\s+/);
  const firstWord = words[0];
  
  if (AVAILABLE_COMMANDS.includes(firstWord)) {
    return {
      command: firstWord,
      confidence: 1.0,
      args: words.slice(1),
    };
  }
  
  return null;
}

// ============================================
// AI PROCESSING
// ============================================

/**
 * Process user message with AI and return intelligent response
 */
async function generateAIResponse(
  message: string,
  history: ChatMessage[],
  context?: { commandExecuted?: string; commandResult?: any }
): Promise<string> {
  const supabase = getSupabaseClient();
  
  // Build messages array for OpenRouter API
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: MASTERMIND_SYSTEM_PROMPT },
  ];
  
  // Add recent history (last 6 messages)
  const recentHistory = history.slice(-6);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    });
  }
  
  // Build the user prompt with context
  let userPrompt = message;
  
  if (context?.commandExecuted) {
    userPrompt = `${message}

[سياق: تم تنفيذ الأمر "${context.commandExecuted}" بنتيجة: ${JSON.stringify(context.commandResult, null, 2)}]

رد بطبيعية مختصرة:`;
  }
  
  messages.push({ role: "user", content: userPrompt });
  
  console.log("[MastermindAI] Generating AI response with Groq...");
  
  // Call Groq with proper error handling
  const response = await generateAIResponseWithGroq(messages, supabase);
  
  if (response) {
    return response;
  }
  
  return "أواجه مشكلة تقنية مؤقتة. جرب مرة أخرى بعد قليل؟";
}

// ============================================
// CHAT HISTORY MANAGEMENT
// ============================================

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error("Missing Supabase credentials");
  }
  
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Save message to chat history
 */
async function saveMessage(message: ChatMessage): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    await supabase.from("chat_history").insert({
      session_id: message.session_id,
      user_id: message.user_id,
      role: message.role,
      content: message.content,
      command_executed: message.command_executed,
      command_result: message.command_result,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[MastermindAI] Failed to save message:", error);
    // Non-critical, don't throw
  }
}

/**
 * Load chat history for user (by user_id, not session_id)
 */
async function loadHistory(userId: string, limit: number = 20): Promise<ChatMessage[]> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from("chat_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(limit);
    
    if (error) {
      console.error("[MastermindAI] Failed to load history:", error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error("[MastermindAI] Failed to load history:", error);
    return [];
  }
}

// ============================================
// MAIN PROCESSING FUNCTION
// ============================================

export interface ProcessMessageOptions {
  sessionId: string;
  userId?: string;
  userEmail?: string;
  bypassAuth?: boolean;
  userSignature?: string;
  isOwner?: boolean;
}

/**
 * Process a user message through the intelligent Mastermind AI
 */
export async function processIntelligentMessage(
  message: string,
  options: ProcessMessageOptions
): Promise<AIResponse> {
  const { sessionId, userId, userEmail, bypassAuth = false, isOwner = false } = options;
  
  // 1. Load conversation history (using userId if available)
  const history = userId ? await loadHistory(userId) : [];
  
  // 2. Save user message
  await saveMessage({
    session_id: sessionId,
    user_id: userId,
    role: "user",
    content: message,
  });
  
  // 3. Detect if this is a command
  const detectedCommand = detectCommand(message);
  
  let response: AIResponse;
  
  if (detectedCommand && detectedCommand.confidence > 0.8) {
    // 4a. Execute the command
    const supabase = getSupabaseClient();
    
    try {
      const commandResult = await executeCommand(
        `${detectedCommand.command} ${detectedCommand.args.join(" ")}`,
        {
          supabase,
          userId: userId || "00000000-0000-0000-0000-000000000000",
          userEmail: userEmail || "admin@azenithliving.com",
          bypassRls: bypassAuth,
          isOwner,
        }
      );
      
      // Generate natural response about the command result
      const aiMessage = await generateAIResponse(message, history, {
        commandExecuted: detectedCommand.command,
        commandResult: commandResult,
      });
      
      response = {
        type: "mixed",
        message: aiMessage,
        command: {
          name: detectedCommand.command,
          args: detectedCommand.args,
          result: commandResult,
        },
      };
      
    } catch (error) {
      // Command failed, explain naturally
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const aiMessage = await generateAIResponse(
        message,
        history,
        { commandExecuted: detectedCommand.command, commandResult: { success: false, error: errorMessage } }
      );
      
      response = {
        type: "mixed",
        message: aiMessage,
        command: {
          name: detectedCommand.command,
          args: detectedCommand.args,
          result: { success: false, error: errorMessage },
        },
      };
    }
    
  } else {
    // 4b. Pure conversation - no command to execute
    const aiMessage = await generateAIResponse(message, history);
    
    response = {
      type: "conversation",
      message: aiMessage,
    };
  }
  
  // 5. Save assistant response
  await saveMessage({
    session_id: sessionId,
    user_id: userId,
    role: "assistant",
    content: response.message,
    command_executed: response.command?.name,
    command_result: response.command?.result ? JSON.stringify(response.command.result) : undefined,
  });
  
  return response;
}

// ============================================
// LEGACY MODE SUPPORT
// ============================================

/**
 * Check if AI mode is enabled
 */
export function isAIModeEnabled(): boolean {
  return process.env.MASTERMIND_MODE === "ai";
}

/**
 * Process message in legacy command mode (rigid commands)
 */
export async function processLegacyMessage(
  message: string,
  options: ProcessMessageOptions
): Promise<AIResponse> {
  const { sessionId, userId, userEmail, bypassAuth = false, isOwner = false } = options;
  
  // Direct command execution without AI processing
  const supabase = getSupabaseClient();
  
  try {
    const result = await executeCommand(message, {
      supabase,
      userId: userId || "00000000-0000-0000-0000-000000000000",
      userEmail: userEmail || "admin@azenithliving.com",
      bypassRls: bypassAuth,
      isOwner,
    });
    
    return {
      type: result.success ? "command" : "conversation",
      message: result.message,
      command: {
        name: message.split(/\s+/)[0],
        args: message.split(/\s+/).slice(1),
        result: result,
      },
    };
  } catch (error) {
    return {
      type: "conversation",
      message: error instanceof Error ? error.message : "Failed to execute command",
    };
  }
}

// ============================================
// EXPORTS
// ============================================

export {
  AVAILABLE_COMMANDS,
  detectCommand,
  generateAIResponse,
  saveMessage,
  loadHistory,
};
