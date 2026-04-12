/**
 * AI Orchestrator - Server Version with DB Key Management
 * Uses api-keys-service for database-backed key rotation
 * SERVER ONLY
 */

"use server";

import {
  getNextAvailableKey,
  getKeyStats,
} from "@/lib/api-keys-service";

// Re-export for convenience
export {
  getKeyFromDB,
  getKeyStats,
  loadKeysFromDB,
  setKeyCooldown,
  incrementKeyUsage,
} from "@/lib/api-keys-service";

// Model Configuration
const CONFIG = {
  GROQ_MODEL: "llama-3.3-70b-versatile",
  OPENROUTER_VISION_MODEL: "anthropic/claude-3.5-sonnet",
  MISTRAL_CODE_MODEL: "codestral-latest",
  MISTRAL_GENERAL_MODEL: "mistral-large-latest",
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
  provider: "groq" | "openrouter" | "mistral",
  fetchFn: (key: string) => Promise<Response>,
  parseFn: (data: any) => T
): Promise<{ success: true; data: T } | { success: false; error: string; status?: number }> {
  for (let attempt = 0; attempt < CONFIG.MAX_RETRIES; attempt++) {
    const keyResult = await getNextAvailableKey(provider);
    if (!keyResult) {
      return { success: false, error: `No API keys available for ${provider}` };
    }
    const key = keyResult.key;

    try {
      const response = await fetchFn(key);

      if (!response.ok) {
        const status = response.status;
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || errorData.message || response.statusText;

        console.error(`[${provider}] Key failed (attempt ${attempt + 1}/${CONFIG.MAX_RETRIES}): ${status} - ${errorMessage}`);

        if (isRetryableError(status)) {
          if (attempt < CONFIG.MAX_RETRIES - 1) {
            await delay(CONFIG.RETRY_DELAY_MS * (attempt + 1));
            continue;
          }
        }

        return { success: false, error: `${provider} API error: ${status} - ${errorMessage}`, status };
      }

      const data = await response.json();
      return { success: true, data: parseFn(data) };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Network error";
      console.error(`[${provider}] Fetch error (attempt ${attempt + 1}/${CONFIG.MAX_RETRIES}): ${errorMessage}`);

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
 * Ask Mistral - Server version with DB key management
 */
export async function askMistralServer(
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

/**
 * Ask Groq - Server version with DB key management
 */
export async function askGroqServer(
  prompt: string,
  options?: { model?: string; temperature?: number; maxTokens?: number; jsonMode?: boolean }
): Promise<{ success: boolean; content: string; error?: string }> {
  const body: Record<string, unknown> = {
    model: options?.model || CONFIG.GROQ_MODEL,
    messages: [{ role: "user", content: prompt }],
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
  return { success: false, content: "", error: result.error };
}

/**
 * Ask OpenRouter - Server version with DB key management
 */
export async function askOpenRouterServer(
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
        "HTTP-Referer": process.env.PRIMARY_DOMAIN || "https://azenithliving.vercel.app",
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
 * Get health status of all key pools
 */
export async function getOrchestratorHealthServer(): Promise<{
  groq: { keys: number; healthy: boolean };
  openrouter: { keys: number; healthy: boolean };
  mistral: { keys: number; healthy: boolean };
}> {
  const [groqStats, openrouterStats, mistralStats] = await Promise.all([
    getKeyStats("groq"),
    getKeyStats("openrouter"),
    getKeyStats("mistral"),
  ]);

  return {
    groq: { keys: groqStats.total, healthy: groqStats.active > 0 },
    openrouter: { keys: openrouterStats.total, healthy: openrouterStats.active > 0 },
    mistral: { keys: mistralStats.total, healthy: mistralStats.active > 0 },
  };
}
