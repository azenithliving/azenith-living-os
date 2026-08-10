/**
 * AI Orchestrator - The Sovereign Neural Spine
 * Phase 2: Unlimited Intelligence
 */

import { runMastermind } from "./mastermind-graph";
import { routeRequest, getBestModelForTask } from "./openrouter-service";
import { getNextAvailableKey, setKeyCooldown, incrementKeyUsage, getKeyStats } from "./api-keys-service";

type AIProvider =
  | "groq"
  | "openrouter"
  | "mistral"
  | "deepseek"
  | "openai"
  | "google"
  | "anthropic"
  | "sambanova"
  | "together"
  | "aimlapi"
  | "cerebras"
  | "cohere";

const CONFIG = {
  // === The Absolute Best Models on the Market ===
  GROQ_MODEL: "llama-3.3-70b-versatile", // Blazing fast, top tier open source
  ANTHROPIC_MODEL: "claude-sonnet-4-5-20250929", // The undisputed king of coding and complex logic
  OPENROUTER_VISION_MODEL: "anthropic/claude-opus-5", // Best vision model
  MISTRAL_CODE_MODEL: "codestral-latest",
  MISTRAL_GENERAL_MODEL: "mistral-large-latest",
  DEEPSEEK_MODEL: "deepseek-v4-flash", // DeepSeek V4 Flash (excellent logic, fast)
  OPENAI_MODEL: "gpt-4o", // Top tier reasoning
  GOOGLE_MODEL: "gemini-3-flash-preview", // Extremely fast and capable
  SAMBANOVA_MODEL: "Meta-Llama-3.3-70B-Instruct", // Lightning fast Llama
  TOGETHER_MODEL: process.env.TOGETHER_MODEL || "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  AIMLAPI_MODEL: process.env.AIMLAPI_MODEL || "openai/gpt-4.1-mini",
  CEREBRAS_MODEL: process.env.CEREBRAS_MODEL || "gpt-oss-120b",
  COHERE_MODEL: process.env.COHERE_MODEL || "command-a-03-2025",
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
  provider: AIProvider,
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

  // Fallbacks (avoid Google first — quota-sensitive)
  const openRouterResult = await askOpenRouter(
    messages[messages.length - 1]?.content || "",
    undefined,
    options
  );
  if (openRouterResult.success) return openRouterResult;

  const mistralResult = await askMistral(messages[messages.length - 1]?.content || "", options);
  if (mistralResult.success) return mistralResult;

  const deepseekResult = await askDeepSeek(messages[messages.length - 1]?.content || "", options);
  if (deepseekResult.success) return deepseekResult;

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
        "HTTP-Referer": process.env.PRIMARY_DOMAIN || "https://azenith-living.vercel.app",
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
  return askOpenRouter(prompt, undefined, { model: "google/gemini-2.5-flash" });
}

export async function askOpenAI(prompt: string, options?: any) {
  return askOpenAIMessages([{ role: "user", content: prompt }], options);
}

export async function askTogetherMessages(
  messages: Array<{ role: string; content: string }>,
  options?: { model?: string; temperature?: number; maxTokens?: number; jsonMode?: boolean }
): Promise<{ success: boolean; content: string; error?: string }> {
  const body: Record<string, unknown> = {
    model: options?.model || CONFIG.TOGETHER_MODEL,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2048,
  };

  if (options?.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const result = await fetchWithRetry(
    "together",
    (key) => fetch("https://api.together.xyz/v1/chat/completions", {
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

export async function askAIMLAPIMessages(
  messages: Array<{ role: string; content: string }>,
  options?: { model?: string; temperature?: number; maxTokens?: number; jsonMode?: boolean }
): Promise<{ success: boolean; content: string; error?: string }> {
  const body: Record<string, unknown> = {
    model: options?.model || CONFIG.AIMLAPI_MODEL,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2048,
  };

  if (options?.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const result = await fetchWithRetry(
    "aimlapi",
    (key) => fetch("https://api.aimlapi.com/v1/chat/completions", {
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

export async function askCerebrasMessages(
  messages: Array<{ role: string; content: string }>,
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<{ success: boolean; content: string; error?: string }> {
  const result = await fetchWithRetry(
    "cerebras",
    (key) => fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options?.model || CONFIG.CEREBRAS_MODEL,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
      }),
    }),
    (data) => data.choices?.[0]?.message?.content || ""
  );

  return result.success ? { success: true, content: result.data } : { success: false, content: "", error: result.error };
}

export async function askCohereMessages(
  messages: Array<{ role: string; content: string }>,
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<{ success: boolean; content: string; error?: string }> {
  const lastUserMessage = [...messages].reverse().find((message) => message.role !== "system")?.content || "";
  const systemPrompt = messages.find((message) => message.role === "system")?.content;
  const result = await fetchWithRetry(
    "cohere",
    (key) => fetch("https://api.cohere.com/v2/chat", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options?.model || CONFIG.COHERE_MODEL,
        messages: [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          { role: "user", content: lastUserMessage },
        ],
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
      }),
    }),
    (data) => data.message?.content?.map((part: { text?: string }) => part.text || "").join("") || ""
  );

  return result.success ? { success: true, content: result.data } : { success: false, content: "", error: result.error };
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

export async function askGoogleMessages(messages: Array<{ role: string; content: string }>, options?: any) {
  const model = options?.model || CONFIG.GOOGLE_MODEL;
  
  // Format messages for Google API
  const formattedContents = messages.map(msg => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }]
  }));
  
  const result = await fetchWithRetry(
    "google",
    (key) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: formattedContents,
        generationConfig: { temperature: options?.temperature ?? 0.7, maxOutputTokens: options?.maxTokens ?? 2048 },
      }),
    }),
    (data) => data.candidates?.[0]?.content?.parts?.[0]?.text || ""
  );
  return result.success ? { success: true, content: result.data } : { success: false, content: "", error: result.error };
}

/**
 * Ask Anthropic (Claude) with full message history
 */
export async function askAnthropicMessages(
  messages: Array<{ role: string; content: string }>,
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<{ success: boolean; content: string; error?: string }> {
  // Extract system prompt if present
  let systemPrompt = "";
  const filteredMessages = messages.filter(m => {
    if (m.role === "system") {
      systemPrompt = m.content;
      return false;
    }
    return true;
  });

  const body: Record<string, unknown> = {
    model: options?.model || CONFIG.ANTHROPIC_MODEL,
    messages: filteredMessages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 2048,
  };

  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const result = await fetchWithRetry(
    "anthropic",
    (key) => fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
    (data) => data.content?.[0]?.text || ""
  );

  return result.success ? { success: true, content: result.data } : { success: false, content: "", error: result.error };
}

/**
 * Ask SambaNova with full message history (extremely fast)
 */
export async function askSambaNovaMessages(
  messages: Array<{ role: string; content: string }>,
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<{ success: boolean; content: string; error?: string }> {
  const result = await fetchWithRetry(
    "sambanova",
    (key) => fetch("https://api.sambanova.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options?.model || CONFIG.SAMBANOVA_MODEL,
        messages: messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
      }),
    }),
    (data) => data.choices?.[0]?.message?.content || ""
  );

  return result.success ? { success: true, content: result.data } : { success: false, content: "", error: result.error };
}

/**
 * Master Orchestrator: Dynamically reads .env fallback configs and routes the request
 * with high availability and smart fallback.
 */
export async function askOrchestratorMessages(
  messages: Array<{ role: string; content: string }>,
  options?: { model?: string; temperature?: number; maxTokens?: number; jsonMode?: boolean }
): Promise<{ success: boolean; content: string; error?: string }> {
  
  const providersToTry = [
    process.env.DEFAULT_AI_PROVIDER || "groq",
    process.env.FALLBACK_AI_PROVIDER_1 || "gemini",
    process.env.FALLBACK_AI_PROVIDER_2 || "openrouter",
    process.env.FALLBACK_AI_PROVIDER_3 || "openai",
  ];

  // Additional emergency fallbacks
  if (!providersToTry.includes("anthropic")) providersToTry.push("anthropic");
  if (!providersToTry.includes("sambanova")) providersToTry.push("sambanova");
  if (!providersToTry.includes("together")) providersToTry.push("together");
  if (!providersToTry.includes("aimlapi")) providersToTry.push("aimlapi");
  if (!providersToTry.includes("cerebras")) providersToTry.push("cerebras");
  if (!providersToTry.includes("cohere")) providersToTry.push("cohere");

  console.log(`[Orchestrator] Starting inference. Provider sequence: ${providersToTry.join(' -> ')}`);

  for (const provider of providersToTry) {
    try {
      console.log(`[Orchestrator] Attempting provider: ${provider}`);
      let result;

      switch (provider.toLowerCase()) {
        case "groq":
          result = await askGroqMessages(messages, options);
          break;
        case "gemini":
        case "google":
          result = await askGoogleMessages(messages, options);
          break;
        case "openai":
          result = await askOpenAIMessages(messages, options);
          break;
        case "anthropic":
        case "claude":
          result = await askAnthropicMessages(messages, options);
          break;
        case "sambanova":
          result = await askSambaNovaMessages(messages, options);
          break;
        case "together":
          result = await askTogetherMessages(messages, options);
          break;
        case "aimlapi":
          result = await askAIMLAPIMessages(messages, options);
          break;
        case "cerebras":
          result = await askCerebrasMessages(messages, options);
          break;
        case "cohere":
          result = await askCohereMessages(messages, options);
          break;
        case "openrouter":
          // OpenRouter is typically called using askGroqMessages structure, but we'll adapt askOpenRouter
          result = await askOpenRouter(messages[messages.length - 1].content);
          break;
        default:
          continue; // skip unknown
      }

      if (result.success && result.content && result.content.trim().length > 0) {
        console.log(`[Orchestrator] ✅ Success with ${provider}`);
        return result;
      } else {
        console.warn(`[Orchestrator] ⚠️ Provider ${provider} failed or returned empty content. Trying next...`);
      }
    } catch (e: any) {
      console.error(`[Orchestrator] ❌ Provider ${provider} threw an error:`, e.message);
    }
  }

  return { success: false, content: "", error: "All Orchestrator fallbacks exhausted. The Hive Mind is unreachable." };
}

/**
 * Ask Hugging Face - Generic interface
 */
export async function askHuggingFace(
  model: string,
  prompt: string,
  options?: { maxTokens?: number; temperature?: number; returnFullText?: boolean }
): Promise<{ success: boolean; content: string; error?: string }> {
  const keys = (process.env.HUGGINGFACE_KEYS || "").split(",").map(k => k.trim()).filter(k => k);
  if (keys.length === 0) return { success: false, content: "", error: "HUGGINGFACE_KEYS not configured" };
  const key = keys[Math.floor(Math.random() * keys.length)];
  try {
    const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: options?.maxTokens ?? 512,
          temperature: options?.temperature ?? 0.7,
          return_full_text: options?.returnFullText ?? false,
        },
      }),
    });
    if (!response.ok) return { success: false, content: "", error: `HF Error: ${response.status}` };
    const data = await response.json();
    const generatedText = Array.isArray(data) ? data[0]?.generated_text : data.generated_text;
    return { success: true, content: generatedText || "" };
  } catch (e: any) { return { success: false, content: "", error: e.message }; }
}

export async function askNileChat(prompt: string, options?: any) {
  return askHuggingFace("MBZUAI-Paris/Nile-Chat-12B", `[INST] ${prompt} [/INST]`, options);
}

export async function askAllam(prompt: string, options?: any) {
  return askHuggingFace("SDAIA/ALLaM-7B-Instruct", `### Instruction:\n${prompt}\n\n### Response:\n`, options);
}
export async function testProviderHealth(provider: string): Promise<{
  responsive: boolean;
  responseTimeMs: number;
  error: string | null;
}> {
  const start = Date.now();
  try {
    let result;
    switch (provider) {
      case "groq":
        result = await askGroq("ping", { maxTokens: 5 });
        break;
      case "mistral":
        result = await askMistral("ping", { maxTokens: 5 });
        break;
      case "openrouter":
        result = await askOpenRouter("ping", undefined, { maxTokens: 5 });
        break;
      case "deepseek":
        result = await askDeepSeek("ping", { maxTokens: 5 });
        break;
      case "openai":
        result = await askOpenAI("ping", { maxTokens: 5 });
        break;
      case "google":
        result = await askGoogle("ping", { maxTokens: 5 });
        break;
      default:
        return { responsive: false, responseTimeMs: 0, error: "Unknown provider" };
    }
    return {
      responsive: result.success && !!result.content,
      responseTimeMs: Date.now() - start,
      error: result.error || null,
    };
  } catch (err: any) {
    return {
      responsive: false,
      responseTimeMs: Date.now() - start,
      error: err.message || "Connection failed",
    };
  }
}

export async function getOrchestratorHealth() {
  const providers = ["groq", "openrouter", "mistral", "deepseek", "openai", "google"] as const;
  const health: any = {};

  const healthPromises = providers.map(async (p) => {
    const stats = await getKeyStats(p);
    const ping = await testProviderHealth(p);
    return {
      provider: p,
      data: {
        keys: stats.total,
        healthy: stats.active > 0 && ping.responsive,
        active: stats.active,
        cooldown: stats.inCooldown,
        responsive: ping.responsive,
        responseTimeMs: ping.responseTimeMs,
        lastError: ping.error,
        lastChecked: new Date().toISOString(),
      },
    };
  });

  const results = await Promise.allSettled(healthPromises);

  results.forEach((result) => {
    if (result.status === "fulfilled") {
      health[result.value.provider] = result.value.data;
    }
  });

  for (const p of providers) {
    if (!health[p]) {
      health[p] = {
        keys: 0,
        healthy: false,
        active: 0,
        cooldown: 0,
        responsive: false,
        responseTimeMs: 0,
        lastError: "Health check failed",
        lastChecked: new Date().toISOString(),
      };
    }
  }

  return health;
}

export class AIOrchestrator {
  async fastText(prompt: string) {
    const chain = [askGroq, askMistral, askOpenRouter, askDeepSeek] as const;
    for (const provider of chain) {
      const result = await provider(prompt);
      if (result.success && result.content?.trim()) return result;
    }
    return askGroq(prompt);
  }
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
