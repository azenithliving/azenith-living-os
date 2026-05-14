/**
 * AI Orchestrator - The Sovereign Neural Spine
 * Phase 2: Unlimited Intelligence
 * 
 * This is now a simplified facade over the Mastermind Graph system.
 * For complex workflows, use mastermind-graph.ts directly.
 */

import { runMastermind } from "./mastermind-graph";
import { routeRequest, getBestModelForTask } from "./openrouter-service";

// Parse key pools from environment (legacy support)
const parseKeyPool = (envValue: string | undefined): string[] => {
  if (!envValue) return [];
  return envValue.split(",").map(k => k.trim()).filter(k => k.length > 0);
};

// Key Pool Configuration
const KEY_POOLS = {
  groq: parseKeyPool(process.env.GROQ_KEYS),
  openrouter: parseKeyPool(process.env.OPENROUTER_KEYS),
  mistral: parseKeyPool(process.env.MISTRAL_KEYS),
  deepseek: parseKeyPool(process.env.DEEPSEEK_KEYS),
  openai: parseKeyPool(process.env.OPENAI_KEYS),
  google: parseKeyPool(process.env.GOOGLE_AI_KEYS || process.env.GEMINI_API_KEY),
};

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

// Key rotation indices per provider
const keyIndices: Record<string, number> = {
  groq: 0,
  openrouter: 0,
  mistral: 0,
  deepseek: 0,
  openai: 0,
  google: 0,
};

// Get next key using round-robin
const getNextKey = (provider: "groq" | "openrouter" | "mistral" | "deepseek" | "openai" | "google"): string | null => {
  const pool = KEY_POOLS[provider];
  if (pool.length === 0) return null;

  const key = pool[keyIndices[provider] % pool.length];
  keyIndices[provider] = (keyIndices[provider] + 1) % pool.length;
  return key;
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
  const pool = KEY_POOLS[provider];
  
  console.log(`[FetchWithRetry] [${requestId}] Provider: ${provider}, Pool size: ${pool.length}, Max retries: ${CONFIG.MAX_RETRIES}`);

  for (let attempt = 0; attempt < CONFIG.MAX_RETRIES; attempt++) {
    const key = getNextKey(provider);
    const keyPrefix = key ? `${key.substring(0, 8)}...` : 'NO_KEY';
    
    console.log(`[FetchWithRetry] [${requestId}] Attempt ${attempt + 1}/${CONFIG.MAX_RETRIES}, Key: ${keyPrefix}`);
    
    if (!key) {
      console.error(`[FetchWithRetry] [${requestId}] No API keys available for ${provider}`);
      return { success: false, error: `No API keys available for ${provider}` };
    }

    try {
      console.log(`[FetchWithRetry] [${requestId}] Making fetch call...`);
      const response = await fetchFn(key);
      
      console.log(`[FetchWithRetry] [${requestId}] Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const status = response.status;
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch (e) {
          console.log(`[FetchWithRetry] [${requestId}] Could not parse error response as JSON`);
        }
        
        const errorMessage = errorData.error?.message || errorData.message || response.statusText;
        const errorDetails = JSON.stringify(errorData).substring(0, 500);

        console.error(`[FetchWithRetry] [${requestId}] [${provider}] Key failed: ${status} - ${errorMessage}`);
        console.error(`[FetchWithRetry] [${requestId}] Error details: ${errorDetails}`);

        if (isRetryableError(status)) {
          if (attempt < CONFIG.MAX_RETRIES - 1) {
            const delayMs = CONFIG.RETRY_DELAY_MS * (attempt + 1);
            console.log(`[FetchWithRetry] [${requestId}] Retryable error, waiting ${delayMs}ms before retry...`);
            await delay(delayMs);
            continue;
          }
        }

        return { success: false, error: `${provider} API error: ${status} - ${errorMessage}`, status };
      }

      const data = await response.json();
      console.log(`[FetchWithRetry] [${requestId}] Success! Parsed response.`);
      return { success: true, data: parseFn(data) };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Network error";
      const errorType = error?.constructor?.name || 'Unknown';
      console.error(`[FetchWithRetry] [${requestId}] [${provider}] Fetch error (attempt ${attempt + 1}): [${errorType}] ${errorMessage}`);
      
      if (error instanceof Error && error.stack) {
        console.error(`[FetchWithRetry] [${requestId}] Stack: ${error.stack.substring(0, 500)}`);
      }

      if (attempt < CONFIG.MAX_RETRIES - 1) {
        const delayMs = CONFIG.RETRY_DELAY_MS * (attempt + 1);
        console.log(`[FetchWithRetry] [${requestId}] Retrying after ${delayMs}ms...`);
        await delay(delayMs);
      } else {
        console.error(`[FetchWithRetry] [${requestId}] All retries exhausted`);
        return { success: false, error: `${provider} fetch failed: ${errorMessage}` };
      }
    }
  }

  console.error(`[FetchWithRetry] [${requestId}] Exhausted all retries for ${provider}`);
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

  if (result.success) {
    return { success: true, content: result.data };
  }
  return { success: false, content: "", error: result.error };
}

interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Ask Groq with full message history (Chat API)
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

  if (result.success) {
    return { success: true, content: result.data };
  }

  // CROSS-PROVIDER FALLBACK: If Groq fails completely, escalate to OpenAI or Google
  console.error(`[Orchestrator] Groq exhausted. Falling back to OpenAI/Google for stability.`);
  
  // Try OpenAI as first fallback
  const openaiResult = await askOpenAIMessages(messages, options);
  if (openaiResult.success) return openaiResult;

  // Final fallback to Google
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

  if (result.success) {
    return { success: true, content: result.data };
  }
  return { success: false, content: "", error: result.error };
}

/**
 * Ask Groq - Primary for Semantic Data, Intent Scoring, and Rapid APIs
 */
export async function askGroq(
  prompt: string,
  options?: { model?: string; temperature?: number; maxTokens?: number; jsonMode?: boolean }
): Promise<{ success: boolean; content: string; error?: string }> {
  return askGroqMessages([{ role: "user", content: prompt }], options);
}

/**
 * Ask OpenRouter - Primary for Vision Analysis and Luxury UX Copywriting
 */
export async function askOpenRouter(
  prompt: string,
  imageUrl?: string,
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<{ success: boolean; content: string; error?: string }> {
  const messages: Array<Record<string, unknown>> = [];

  if (imageUrl) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: imageUrl } },
      ],
    });
  } else {
    messages.push({ role: "user", content: prompt });
  }

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

  if (result.success) {
    return { success: true, content: result.data };
  }
  return { success: false, content: "", error: result.error };
}

/**
 * Ask DeepSeek - Primary for Arabic Content and General Intelligence
 */
export async function askDeepSeek(
  prompt: string,
  options?: { model?: string; temperature?: number; maxTokens?: number; jsonMode?: boolean }
): Promise<{ success: boolean; content: string; error?: string }> {
  const requestId = `deepseek_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`[AskDeepSeek] [${requestId}] ===== DEEPSEEK REQUEST =====`);
  
  if (KEY_POOLS.deepseek.length === 0) {
    console.warn(`[AskDeepSeek] [${requestId}] No DeepSeek keys, falling back to OpenRouter...`);
    return askOpenRouter(prompt, undefined, { model: "google/gemini-2.0-flash:free" });
  }

  const body: Record<string, unknown> = {
    model: options?.model || CONFIG.DEEPSEEK_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2048,
  };

  if (options?.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const result = await fetchWithRetry(
    "deepseek",
    (key) => fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
    (data) => data.choices?.[0]?.message?.content || ""
  );

  if (result.success) {
    return { success: true, content: result.data };
  }
  
  // FALLBACK TO OPENROUTER IF DEEPSEEK FAILS
  console.error(`[AskDeepSeek] [${requestId}] REQUEST FAILED: ${result.error}. Falling back to OpenRouter...`);
  return askOpenRouter(prompt, undefined, { model: "google/gemini-2.0-pro-exp-02-05:free" });
}

/**
 * Ask OpenAI - Direct access to GPT-4o pool
 */
export async function askOpenAI(
  prompt: string,
  options?: { model?: string; temperature?: number; maxTokens?: number; jsonMode?: boolean }
): Promise<{ success: boolean; content: string; error?: string }> {
  const body: Record<string, unknown> = {
    model: options?.model || CONFIG.OPENAI_MODEL,
    messages: [{ role: "user", content: prompt }],
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

  if (result.success) {
    return { success: true, content: result.data };
  }
  return { success: false, content: "", error: result.error };
}

/**
 * Ask Google - Direct access to Gemini 2.0 pool
 */
export async function askGoogle(
  prompt: string,
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<{ success: boolean; content: string; error?: string }> {
  const model = options?.model || CONFIG.GOOGLE_MODEL;
  
  const result = await fetchWithRetry(
    "google",
    (key) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens: options?.maxTokens ?? 2048,
        },
      }),
    }),
    (data) => data.candidates?.[0]?.content?.parts?.[0]?.text || ""
  );

  if (result.success) {
    return { success: true, content: result.data };
  }
  return { success: false, content: "", error: result.error };
}

/**
 * Hugging Face Key Pool with Rotation
 */
const HUGGINGFACE_KEY_POOL = parseKeyPool(process.env.HUGGINGFACE_KEYS);
let huggingFaceKeyIndex = 0;

// Get next Hugging Face key using round-robin
const getNextHuggingFaceKey = (): string | null => {
  if (HUGGINGFACE_KEY_POOL.length === 0) return null;
  const key = HUGGINGFACE_KEY_POOL[huggingFaceKeyIndex % HUGGINGFACE_KEY_POOL.length];
  huggingFaceKeyIndex = (huggingFaceKeyIndex + 1) % HUGGINGFACE_KEY_POOL.length;
  return key;
};

// Check if error is retryable (429 rate limit or 503 model loading)
const isHuggingFaceRetryable = (status: number): boolean => {
  return status === 429 || status === 503;
};

/**
 * Hugging Face fetch helper with key rotation and retry logic
 */
async function fetchHuggingFace(
  model: string,
  inputs: string,
  parameters?: Record<string, unknown>
): Promise<{ success: true; data: string } | { success: false; error: string; status?: number }> {
  if (HUGGINGFACE_KEY_POOL.length === 0) {
    return { success: false, error: "HUGGINGFACE_KEYS not configured" };
  }

  const maxRetries = Math.min(HUGGINGFACE_KEY_POOL.length * 2, 8); // Try each key twice max

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const key = getNextHuggingFaceKey();
    if (!key) {
      return { success: false, error: "No Hugging Face API keys available" };
    }

    try {
      const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs,
          parameters: parameters || { max_new_tokens: 512, temperature: 0.7, return_full_text: false },
        }),
      });

      if (!response.ok) {
        const status = response.status;
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.message || response.statusText;

        if (isHuggingFaceRetryable(status)) {
          if (attempt < maxRetries - 1) {
            const waitMs = status === 503 ? 3000 : 1000;
            await delay(waitMs * (attempt + 1));
            continue;
          }
        }

        return { success: false, error: `HuggingFace API error: ${status} - ${errorMessage}`, status };
      }

      const data = await response.json();
      const generatedText = Array.isArray(data) ? data[0]?.generated_text : data.generated_text;
      return { success: true, data: generatedText || "" };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Network error";
      if (attempt < maxRetries - 1) {
        await delay(1000 * (attempt + 1));
      } else {
        return { success: false, error: `HuggingFace fetch failed: ${errorMessage}` };
      }
    }
  }

  return { success: false, error: "HuggingFace exhausted all keys and retries" };
}

/**
 * Ask Hugging Face - Generic interface with key rotation
 */
export async function askHuggingFace(
  model: string,
  prompt: string,
  options?: { maxTokens?: number; temperature?: number; returnFullText?: boolean }
): Promise<{ success: boolean; content: string; error?: string }> {
  const result = await fetchHuggingFace(
    model,
    prompt,
    {
      max_new_tokens: options?.maxTokens ?? 512,
      temperature: options?.temperature ?? 0.7,
      return_full_text: options?.returnFullText ?? false,
    }
  );

  if (result.success) {
    return { success: true, content: result.data };
  }
  return { success: false, content: "", error: result.error };
}

/**
 * Ask Nile Chat - Egyptian Arabic/Arabizi Chat Model
 */
export async function askNileChat(
  prompt: string,
  options?: { maxTokens?: number; temperature?: number }
): Promise<{ success: boolean; content: string; error?: string }> {
  const MODEL = "MBZUAI-Paris/Nile-Chat-12B";
  const formattedPrompt = `[INST] ${prompt} [/INST]`;

  const result = await fetchHuggingFace(
    MODEL,
    formattedPrompt,
    {
      max_new_tokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature ?? 0.7,
      return_full_text: false,
      do_sample: true,
    }
  );

  if (result.success) {
    return { success: true, content: result.data };
  }
  return { success: false, content: "", error: result.error };
}

/**
 * Ask ALLaM - Gulf Arabic Premium Content Model
 */
export async function askAllam(
  prompt: string,
  options?: { maxTokens?: number; temperature?: number }
): Promise<{ success: boolean; content: string; error?: string }> {
  const MODEL = "SDAIA/ALLaM-7B-Instruct";
  const formattedPrompt = `### Instruction:
${prompt}

### Response:
`;

  const result = await fetchHuggingFace(
    MODEL,
    formattedPrompt,
    {
      max_new_tokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature ?? 0.6,
      return_full_text: false,
      do_sample: true,
      repetition_penalty: 1.1,
    }
  );

  if (result.success) {
    return { success: true, content: result.data };
  }
  return { success: false, content: "", error: result.error };
}

/**
 * Get health status of all key pools
 */
export function getOrchestratorHealth(): {
  groq: { keys: number; healthy: boolean };
  openrouter: { keys: number; healthy: boolean };
  mistral: { keys: number; healthy: boolean };
  deepseek: { keys: number; healthy: boolean };
  openai: { keys: number; healthy: boolean };
  google: { keys: number; healthy: boolean };
} {
  return {
    groq: { keys: KEY_POOLS.groq.length, healthy: KEY_POOLS.groq.length > 0 },
    openrouter: { keys: KEY_POOLS.openrouter.length, healthy: KEY_POOLS.openrouter.length > 0 },
    mistral: { keys: KEY_POOLS.mistral.length, healthy: KEY_POOLS.mistral.length > 0 },
    deepseek: { keys: KEY_POOLS.deepseek.length, healthy: KEY_POOLS.deepseek.length > 0 },
    openai: { keys: KEY_POOLS.openai.length, healthy: KEY_POOLS.openai.length > 0 },
    google: { keys: KEY_POOLS.google.length, healthy: KEY_POOLS.google.length > 0 },
  };
}

/**
 * Legacy singleton instance (for backward compatibility)
 */
export class AIOrchestrator {
  async fastText(prompt: string): Promise<{ success: boolean; content: string; error?: string }> {
    return askGroq(prompt);
  }

  async analyzeVision(imageUrl: string, prompt: string): Promise<{ success: boolean; analysis: string; error?: string }> {
    const result = await askOpenRouter(prompt, imageUrl);
    return {
      success: result.success,
      analysis: result.content,
      error: result.error,
    };
  }

  async askDeepSeek(prompt: string, options?: { model?: string; temperature?: number; maxTokens?: number; jsonMode?: boolean }): Promise<{ success: boolean; content: string; error?: string }> {
    return askDeepSeek(prompt, options);
  }

  getKeyStatus() {
    const health = getOrchestratorHealth();
    return {
      groqConfigured: health.groq.healthy,
      openRouterConfigured: health.openrouter.healthy,
      mistralConfigured: health.mistral.healthy,
      deepseekConfigured: health.deepseek.healthy,
      openaiConfigured: health.openai.healthy,
      googleConfigured: health.google.healthy,
    };
  }

  async processWithMastermind(
    command: string,
    userId: string,
    context?: Record<string, unknown>
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    try {
      const state = await runMastermind(command, userId, context);
      return {
        success: state.errors.length === 0,
        result: {
          analysis: state.analysis,
          plan: state.plan,
          results: state.results,
          finalReport: state.finalReport,
          logs: state.logs,
        },
        error: state.errors.length > 0 ? state.errors.join("\n") : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Mastermind processing failed",
      };
    }
  }
}

export const aiOrchestrator = new AIOrchestrator();

/**
 * Create LLM client for a specific provider
 */
export function createLLMClient(provider: "deepseek" | "groq" | "mistral" | "openrouter" | "openai" | "google") {
  return {
    async complete(prompt: string): Promise<string> {
      let result;
      switch (provider) {
        case "openai":
          result = await askOpenAI(prompt);
          break;
        case "google":
          result = await askGoogle(prompt);
          break;
        case "deepseek":
          result = await askDeepSeek(prompt, { temperature: 0.7, maxTokens: 1000 });
          break;
        case "groq":
          result = await askGroq(prompt);
          break;
        case "mistral":
          result = await askMistral(prompt);
          break;
        case "openrouter":
          result = await askOpenRouter(prompt);
          break;
        default:
          result = await askDeepSeek(prompt, { temperature: 0.7, maxTokens: 1000 });
      }
      return result.success ? result.content : "آسف، حصل مشكلة في الاتصال. جرب تاني بعد شوية. 😅";
    },
  };
}
