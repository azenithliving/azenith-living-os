/**
 * Mastermind AI System - Natural Language Intelligence
 *
 * "I understand you, not just your commands."
 *
 * This module provides:
 * 1. Natural language understanding (Arabic & English)
 * 2. Multi-provider AI with round-robin key management
 * 3. Automatic command detection and execution
 * 4. Context-aware conversation memory
 * 5. Intelligent fallback between providers (Groq → Mistral → OpenRouter)
 */

import { createClient } from "@supabase/supabase-js";
import { executeCommand } from "./command-executor";

// ============================================
// API CONFIGURATION
// ============================================

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Models
const GROQ_MODEL = "llama-3.3-70b-versatile";
const MISTRAL_MODEL = "mistral-large-latest";
const OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

// ============================================
// KEY MANAGEMENT - Round Robin & Cooldown
// ============================================

interface APIKeyRecord {
  id: number;
  provider: string;
  key: string;
  is_active: boolean;
  cooldown_until: string | null;
  total_requests: number;
  last_used_at: string;
  created_at: string;
}

// In-memory storage for round-robin indices and cooldown tracking
const roundRobinIndices: Record<string, number> = {};
const keyCooldowns: Record<string, number> = {}; // key -> cooldown expiry timestamp

/**
 * Get all active keys from database for a provider
 */
async function getActiveKeysFromDB(
  supabase: any,
  provider: string
): Promise<APIKeyRecord[]> {
  try {
    console.log(`[MastermindAI] Fetching active keys for ${provider} from database...`);

    const { data, error } = await supabase
      .from("api_keys")
      .select("*")
      .eq("provider", provider)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(`[MastermindAI] Database error fetching ${provider} keys:`, error.message);
      return [];
    }

    // Filter out keys that are in cooldown
    const now = Date.now();
    const rawKeys = (data || []) as unknown as APIKeyRecord[];
    const availableKeys = rawKeys.filter((key: APIKeyRecord) => {
      const cooldownExpiry = keyCooldowns[key.key] || 0;
      return cooldownExpiry < now;
    });

    console.log(`[MastermindAI] Found ${availableKeys.length} available ${provider} keys (${rawKeys.length} total, ${rawKeys.length - availableKeys.length} in cooldown)`);

    return availableKeys;
  } catch (err) {
    console.error(`[MastermindAI] Exception fetching ${provider} keys:`, err);
    return [];
  }
}

/**
 * Get next key using round-robin algorithm
 */
async function roundRobinKey(
  supabase: any,
  provider: string
): Promise<string | null> {
  const keys = await getActiveKeysFromDB(supabase, provider);

  if (keys.length === 0) {
    console.warn(`[MastermindAI] No active ${provider} keys available`);
    return null;
  }

  // Initialize or increment round-robin index
  if (!(provider in roundRobinIndices)) {
    roundRobinIndices[provider] = 0;
  }

  const currentIndex = roundRobinIndices[provider] % keys.length;
  roundRobinIndices[provider] = (roundRobinIndices[provider] + 1) % keys.length;

  const selectedKey = keys[currentIndex];

  // Log key usage (first 6 chars only for security)
  const keyPrefix = selectedKey.key.substring(0, 6);
  console.log(`[MastermindAI] Using ${provider} key: ${keyPrefix}... (${keys.length} keys available)`);

  return selectedKey.key;
}

/**
 * Mark a key as being in cooldown (temporary failure)
 */
function markKeyCooldown(provider: string, key: string, minutes: number): void {
  const cooldownMs = minutes * 60 * 1000;
  keyCooldowns[key] = Date.now() + cooldownMs;
  const keyPrefix = key.substring(0, 6);
  console.log(`[MastermindAI] ${provider} key ${keyPrefix}... put in cooldown for ${minutes} minutes`);
}

/**
 * Get environment key as fallback
 */
function getEnvKey(provider: string): string | null {
  const envVars: Record<string, string | undefined> = {
    groq: process.env.GROQ_API_KEY,
    mistral: process.env.MISTRAL_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
  };

  const key = envVars[provider];
  if (key) {
    const keyPrefix = key.substring(0, 6);
    console.log(`[MastermindAI] Using ${provider} key from environment: ${keyPrefix}... (fallback)`);
    return key;
  }

  console.warn(`[MastermindAI] No ${provider} API key found in environment`);
  return null;
}

// ============================================
// API RESPONSE TYPES
// ============================================

interface AIProviderResponse {
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

// ============================================
// PROVIDER API CALLS
// ============================================

/**
 * Call Groq API with retry logic and key rotation
 */
async function callGroq(
  messages: Array<{ role: string; content: string }>,
  supabase: any,
  retries = 2
): Promise<AIProviderResponse | null> {
  const requestId = Math.random().toString(36).substring(7);

  console.log(`[MastermindAI] [${requestId}] Groq request with ${retries} retries available`);

  for (let attempt = 0; attempt <= retries; attempt++) {
    let apiKey: string | null = null;

    // Try database keys first, then env fallback
    apiKey = await roundRobinKey(supabase, "groq");
    if (!apiKey) {
      apiKey = getEnvKey("groq");
    }

    if (!apiKey) {
      console.error(`[MastermindAI] [${requestId}] No Groq API key available`);
      return null;
    }

    const keyPrefix = apiKey.substring(0, 6);
    console.log(`[MastermindAI] [${requestId}] Attempt ${attempt + 1} using key: ${keyPrefix}...`);

    try {
      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages,
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });

      console.log(`[MastermindAI] [${requestId}] Response status: ${response.status}`);

      // Handle rate limiting (429) and server errors (5xx)
      if (response.status === 429 || response.status >= 500) {
        const cooldownMinutes = response.status === 429 ? 5 : 1;
        markKeyCooldown("groq", apiKey, cooldownMinutes);

        if (attempt < retries) {
          console.log(`[MastermindAI] [${requestId}] Retrying with next key...`);
          continue;
        }
        return null;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[MastermindAI] [${requestId}] API error (${response.status}):`, errorText);
        return null;
      }

      const data = await response.json() as AIProviderResponse;

      if (data.error) {
        console.error(`[MastermindAI] [${requestId}] API returned error:`, data.error);
        return null;
      }

      console.log(`[MastermindAI] [${requestId}] Success! Model: ${data.model}`);
      return data;
    } catch (error) {
      console.error(`[MastermindAI] [${requestId}] Exception calling Groq:`, error);
      markKeyCooldown("groq", apiKey, 2); // 2 min cooldown on network errors

      if (attempt < retries) {
        console.log(`[MastermindAI] [${requestId}] Retrying with next key...`);
        continue;
      }
      return null;
    }
  }

  return null;
}

/**
 * Call Mistral API with retry logic and key rotation
 */
async function callMistral(
  messages: Array<{ role: string; content: string }>,
  supabase: any,
  retries = 2
): Promise<AIProviderResponse | null> {
  const requestId = Math.random().toString(36).substring(7);

  console.log(`[MastermindAI] [${requestId}] Mistral request with ${retries} retries available`);

  for (let attempt = 0; attempt <= retries; attempt++) {
    let apiKey: string | null = null;

    apiKey = await roundRobinKey(supabase, "mistral");
    if (!apiKey) {
      apiKey = getEnvKey("mistral");
    }

    if (!apiKey) {
      console.error(`[MastermindAI] [${requestId}] No Mistral API key available`);
      return null;
    }

    const keyPrefix = apiKey.substring(0, 6);
    console.log(`[MastermindAI] [${requestId}] Attempt ${attempt + 1} using key: ${keyPrefix}...`);

    try {
      const response = await fetch(MISTRAL_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MISTRAL_MODEL,
          messages,
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });

      console.log(`[MastermindAI] [${requestId}] Response status: ${response.status}`);

      if (response.status === 429 || response.status >= 500) {
        const cooldownMinutes = response.status === 429 ? 5 : 1;
        markKeyCooldown("mistral", apiKey, cooldownMinutes);

        if (attempt < retries) {
          console.log(`[MastermindAI] [${requestId}] Retrying with next key...`);
          continue;
        }
        return null;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[MastermindAI] [${requestId}] API error (${response.status}):`, errorText);
        return null;
      }

      const data = await response.json() as AIProviderResponse;

      if (data.error) {
        console.error(`[MastermindAI] [${requestId}] API returned error:`, data.error);
        return null;
      }

      console.log(`[MastermindAI] [${requestId}] Success! Model: ${data.model}`);
      return data;
    } catch (error) {
      console.error(`[MastermindAI] [${requestId}] Exception calling Mistral:`, error);
      markKeyCooldown("mistral", apiKey, 2);

      if (attempt < retries) {
        console.log(`[MastermindAI] [${requestId}] Retrying with next key...`);
        continue;
      }
      return null;
    }
  }

  return null;
}

/**
 * Call OpenRouter API with retry logic and key rotation
 */
async function callOpenRouter(
  messages: Array<{ role: string; content: string }>,
  supabase: any,
  retries = 2
): Promise<AIProviderResponse | null> {
  const requestId = Math.random().toString(36).substring(7);

  console.log(`[MastermindAI] [${requestId}] OpenRouter request with ${retries} retries available`);

  for (let attempt = 0; attempt <= retries; attempt++) {
    let apiKey: string | null = null;

    apiKey = await roundRobinKey(supabase, "openrouter");
    if (!apiKey) {
      apiKey = getEnvKey("openrouter");
    }

    if (!apiKey) {
      console.error(`[MastermindAI] [${requestId}] No OpenRouter API key available`);
      return null;
    }

    const keyPrefix = apiKey.substring(0, 6);
    console.log(`[MastermindAI] [${requestId}] Attempt ${attempt + 1} using key: ${keyPrefix}...`);

    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://azenithliving.com",
          "X-Title": "Azenith Living Mastermind",
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages,
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });

      console.log(`[MastermindAI] [${requestId}] Response status: ${response.status}`);

      if (response.status === 429 || response.status >= 500) {
        const cooldownMinutes = response.status === 429 ? 5 : 1;
        markKeyCooldown("openrouter", apiKey, cooldownMinutes);

        if (attempt < retries) {
          console.log(`[MastermindAI] [${requestId}] Retrying with next key...`);
          continue;
        }
        return null;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[MastermindAI] [${requestId}] API error (${response.status}):`, errorText);
        return null;
      }

      const data = await response.json() as AIProviderResponse;

      if (data.error) {
        console.error(`[MastermindAI] [${requestId}] API returned error:`, data.error);
        return null;
      }

      console.log(`[MastermindAI] [${requestId}] Success! Model: ${data.model}`);
      return data;
    } catch (error) {
      console.error(`[MastermindAI] [${requestId}] Exception calling OpenRouter:`, error);
      markKeyCooldown("openrouter", apiKey, 2);

      if (attempt < retries) {
        console.log(`[MastermindAI] [${requestId}] Retrying with next key...`);
        continue;
      }
      return null;
    }
  }

  return null;
}

/**
 * Generate AI response with provider fallback: Groq → Mistral → OpenRouter
 */
async function generateAIResponseWithProviderFallback(
  messages: Array<{ role: string; content: string }>,
  supabase: any
): Promise<string | null> {

  // Try Groq first
  console.log("[MastermindAI] Attempting with Groq provider...");
  const groqResponse = await callGroq(messages, supabase);

  if (groqResponse?.choices?.[0]?.message?.content) {
    return groqResponse.choices[0].message.content.trim();
  }

  console.log("[MastermindAI] Groq failed, trying Mistral...");

  // Fallback to Mistral
  const mistralResponse = await callMistral(messages, supabase);

  if (mistralResponse?.choices?.[0]?.message?.content) {
    return mistralResponse.choices[0].message.content.trim();
  }

  console.log("[MastermindAI] Mistral failed, trying OpenRouter...");

  // Final fallback to OpenRouter
  const openRouterResponse = await callOpenRouter(messages, supabase);

  if (openRouterResponse?.choices?.[0]?.message?.content) {
    return openRouterResponse.choices[0].message.content.trim();
  }

  console.error("[MastermindAI] All providers failed");
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
  
  // Call AI with provider fallback (Groq → Mistral → OpenRouter)
  const response = await generateAIResponseWithProviderFallback(messages, supabase);
  
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
