/**
 * AI Orchestrator - The Sovereign Neural Spine
 * Phase 2: Unlimited Intelligence
 */

import { runMastermind } from "./mastermind-graph";
import { routeRequest, getBestModelForTask } from "./openrouter-service";
import { getNextAvailableKey, setKeyCooldown, incrementKeyUsage, getKeyStats } from "./api-keys-service";

// Model Configuration
const CONFIG = {
  GROQ_MODEL: "llama-3.3-70b-versatile",
  OPENROUTER_VISION_MODEL: "anthropic/claude-3.5-sonnet",
  MISTRAL_CODE_MODEL: "codestral-latest",
  MISTRAL_GENERAL_MODEL: "mistral-large-latest",
  DEEPSEEK_MODEL: "deepseek-chat",
  OPENAI_MODEL: "gpt-4o",
  GOOGLE_MODEL: "gemini-2.0-flash",
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 500,
};

// Check if error is retryable
const isRetryableError = (status: number): boolean => {
  return status === 429 || status >= 500;
};

// Delay helper
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// Provider-specific fetch with retry logic
async function fetchWithRetry<T>(
  provider: "groq" | "openrouter" | "mistral" | "deepseek" | "openai" | "google",
  fetchFn: (key: string) => Promise<Response>,
  parseFn: (data: any) => T
): Promise<{ success: true; data: T } | { success: false; error: string; status?: number }> {
  const requestId = `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  for (let attempt = 0; attempt < CONFIG.MAX_RETRIES; attempt++) {
    const keyData = await getNextAvailableKey(provider);
    
    if (!keyData) {
      console.error(`[FetchWithRetry] [${requestId}] No API keys available for ${provider}`);
      return { success: false, error: `No API keys available for ${provider}` };
    }

    const { key } = keyData;
    const keyPrefix = `${key.substring(0, 8)}...`;
    
    try {
      const response = await fetchFn(key);
      
      if (!response.ok) {
        const status = response.status;
        let errorData: any = {};
        try { errorData = await response.json(); } catch (e) {}
        
        const errorMessage = errorData.error?.message || errorData.message || response.statusText;

        if (isRetryableError(status)) {
          // Set cooldown for this specific key
          await setKeyCooldown(provider, key, 30000); // 30s cooldown
          
          if (attempt < CONFIG.MAX_RETRIES - 1) {
            await delay(CONFIG.RETRY_DELAY_MS * (attempt + 1));
            continue;
          }
        }

        return { success: false, error: `${provider} API error: ${status} - ${errorMessage}`, status };
      }

      const data = await response.json();
      await incrementKeyUsage(provider, key);
      return { success: true, data: parseFn(data) };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Network error";
      if (attempt < CONFIG.MAX_RETRIES - 1) {
        await delay(CONFIG.RETRY_DELAY_MS * (attempt + 1));
      } else {
        return { success: false, error: `${provider} fetch failed: ${errorMessage}` };
      }
    }
  }

  return { success: false, error: `${provider} exhausted all retries` };
}

/**
 * Ask Mistral - Primary for Code, Middleware, and Self-Healing
 */
export async function askMistral(
  prompt: string,
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<{ success: boolean; content: string; error?: string }> {
  const result = await fetchWithRetry(
    "mistral",
    (key) => fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options?.model || CONFIG.MISTRAL_GENERAL_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
      }),
    }),
    (data) => data.choices?.[0]?.message?.content || ""
  );

  return result.success ? { success: true, content: result.data } : { success: false, content: "", error: result.error };
}

/**
 * Ask Groq with full message history
 */
export async function askGroqMessages(
  messages: Array<{ role: string; content: string }>,
  options?: { model?: string; temperature?: number; maxTokens?: number; jsonMode?: boolean }
): Promise<{ success: boolean; content: string; error?: string }> {
  const body: Record<string, unknown> = {
    model: options?.model || CONFIG.GROQ_MODEL,
    messages: messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2048,
  };

  if (options?.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const result = await fetchWithRetry(
    "groq",
    (key) => fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
    (data) => data.choices?.[0]?.message?.content || ""
  );

  if (result.success) return { success: true, content: result.data };

  // Fallbacks
  const openaiResult = await askOpenAIMessages(messages, options);
  if (openaiResult.success) return openaiResult;

  return askGoogle(messages[messages.length - 1].content, options);
}

/**
 * Ask OpenAI with full message history
 */
export async function askOpenAIMessages(
  messages: Array<{ role: string; content: string }>,
  options?: { model?: string; temperature?: number; maxTokens?: number; jsonMode?: boolean }
): Promise<{ success: boolean; content: string; error?: string }> {
  const body: Record<string, unknown> = {
    model: options?.model || CONFIG.OPENAI_MODEL,
    messages: messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2048,
  };

  if (options?.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const result = await fetchWithRetry(
    "openai",
    (key) => fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
    (data) => data.choices?.[0]?.message?.content || ""
  );

  return result.success ? { success: true, content: result.data } : { success: false, content: "", error: result.error };
}

export async function askGroq(prompt: string, options?: any) {
  return askGroqMessages([{ role: "user", content: prompt }], options);
}

export async function askOpenRouter(prompt: string, imageUrl?: string, options?: any) {
  const messages: any[] = imageUrl ? [
    { role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: imageUrl } }] }
  ] : [{ role: "user", content: prompt }];

  const result = await fetchWithRetry(
    "openrouter",
    (key) => fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.PRIMARY_DOMAIN || "https://azenith-living-os.vercel.app",
        "X-Title": "Azenith Living",
      },
      body: JSON.stringify({
        model: options?.model || CONFIG.OPENROUTER_VISION_MODEL,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
      }),
    }),
    (data) => data.choices?.[0]?.message?.content || ""
  );

  return result.success ? { success: true, content: result.data } : { success: false, content: "", error: result.error };
}

export async function askDeepSeek(prompt: string, options?: any) {
  const result = await fetchWithRetry(
    "deepseek",
    (key) => fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options?.model || CONFIG.DEEPSEEK_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
      }),
    }),
    (data) => data.choices?.[0]?.message?.content || ""
  );

  if (result.success) return { success: true, content: result.data };
  return askOpenRouter(prompt, undefined, { model: "google/gemini-2.0-flash:free" });
}

export async function askOpenAI(prompt: string, options?: any) {
  return askOpenAIMessages([{ role: "user", content: prompt }], options);
}

export async function askGoogle(prompt: string, options?: any) {
  const model = options?.model || CONFIG.GOOGLE_MODEL;
  const result = await fetchWithRetry(
    "google",
    (key) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: options?.temperature ?? 0.7, maxOutputTokens: options?.maxTokens ?? 2048 },
      }),
    }),
    (data) => data.candidates?.[0]?.content?.parts?.[0]?.text || ""
  );
  return result.success ? { success: true, content: result.data } : { success: false, content: "", error: result.error };
}

/**
 * Get health status of all key pools
 */
export async function getOrchestratorHealth() {
  const providers = ["groq", "openrouter", "mistral", "deepseek", "openai", "google"] as const;
  const health: any = {};
  
  for (const p of providers) {
    const stats = await getKeyStats(p);
    health[p] = { 
      keys: stats.total, 
      healthy: stats.active > 0,
      active: stats.active,
      cooldown: stats.inCooldown
    };
  }
  
  return health;
}

export class AIOrchestrator {
  async fastText(prompt: string) { return askGroq(prompt); }
  async analyzeVision(imageUrl: string, prompt: string) {
    const res = await askOpenRouter(prompt, imageUrl);
    return { success: res.success, analysis: res.content, error: res.error };
  }
  async askDeepSeek(p: string, o?: any) { return askDeepSeek(p, o); }
  async getKeyStatus() {
    const h = await getOrchestratorHealth();
    return {
      groqConfigured: h.groq.healthy,
      openRouterConfigured: h.openrouter.healthy,
      mistralConfigured: h.mistral.healthy,
      deepseekConfigured: h.deepseek.healthy,
      openaiConfigured: h.openai.healthy,
      googleConfigured: h.google.healthy,
    };
  }
  async processWithMastermind(command: string, userId: string, context?: any) {
    try {
      const state = await runMastermind(command, userId, context);
      return { success: state.errors.length === 0, result: state, error: state.errors.join("\n") };
    } catch (e: any) { return { success: false, error: e.message }; }
  }
}

export const aiOrchestrator = new AIOrchestrator();

export function createLLMClient(provider: any) {
  return {
    async complete(prompt: string): Promise<string> {
      let res;
      if (provider === "openai") res = await askOpenAI(prompt);
      else if (provider === "google") res = await askGoogle(prompt);
      else if (provider === "deepseek") res = await askDeepSeek(prompt);
      else if (provider === "groq") res = await askGroq(prompt);
      else if (provider === "mistral") res = await askMistral(prompt);
      else if (provider === "openrouter") res = await askOpenRouter(prompt);
      else res = await askDeepSeek(prompt);
      return res.success ? res.content : "Connection error. 😅";
    }
  };
}
