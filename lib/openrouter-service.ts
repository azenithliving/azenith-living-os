/**
 * OpenRouter Service - Unified Gateway to 44+ Free AI Models
 * Sovereign HyperMind - Phase 2: Unlimited Intelligence
 * 
 * OpenRouter provides free access to multiple AI models without API keys
 * for testing purposes. Optional API key can be added for higher limits.
 */

export interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  context_length: number;
  pricing: {
    prompt: number;
    completion: number;
  };
  top_provider?: string;
}

export interface ModelRequest {
  modelPreference?: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  options?: Record<string, unknown>;
}

export interface ModelResponse {
  success: boolean;
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: string;
}

// قائمة النماذج المجانية المتاحة على OpenRouter
const FREE_MODELS: Record<string, string[]> = {
  coding: [
    "mistralai/codestral-2501",
    "deepseek/deepseek-coder-v2",
    "nousresearch/hermes-3-llama-3.1-405b",
  ],
  translation: [
    "google/gemma-2-9b-it",
    "mistralai/mistral-7b-instruct-v0.3",
    "meta-llama/llama-3.1-8b-instruct",
  ],
  vision: [
    "openai/gpt-4o-mini",
    "google/gemini-flash-1.5",
    "meta-llama/llama-3.2-90b-vision-instruct",
  ],
  creative: [
    "anthropic/claude-3.5-haiku",
    "qwen/qwen-2.5-72b-instruct",
    "microsoft/wizardlm-2-7b",
  ],
  analysis: [
    "perplexity/llama-3.1-sonar-small-128k-online",
    "openai/gpt-4o-mini",
    "anthropic/claude-3.5-haiku",
  ],
  general: [
    "meta-llama/llama-3.1-8b-instruct",
    "mistralai/mistral-7b-instruct-v0.3",
    "google/gemma-2-9b-it",
  ],
};

// الأولويات للنماذج
const MODEL_PRIORITIES: Record<string, string> = {
  coding: "deepseek/deepseek-coder-v2",
  translation: "google/gemma-2-9b-it",
  vision: "google/gemini-flash-1.5",
  creative: "anthropic/claude-3.5-haiku",
  analysis: "openai/gpt-4o-mini",
  general: "meta-llama/llama-3.1-8b-instruct",
  planning: "moonshotai/kimi-k2",
  security: "anthropic/claude-3.5-haiku",
};

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1";
const API_KEY = process.env.OPENROUTER_API_KEY || "";

/**
 * Get available free models from OpenRouter
 */
export async function getAvailableModels(): Promise<OpenRouterModel[]> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Azenith Sovereign",
    };

    if (API_KEY) {
      headers["Authorization"] = `Bearer ${API_KEY}`;
    }

    const response = await fetch(`${OPENROUTER_API_URL}/models`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    
    // فلترة النماذج المجانية (السعر = 0)
    return data.data.filter((model: OpenRouterModel) => 
      model.pricing.prompt === 0 && model.pricing.completion === 0
    );
  } catch (error) {
    console.error("Failed to fetch models:", error);
    // إرجاع قائمة النماذج المعروفة في حالة الفشل
    return getFallbackModels();
  }
}

/**
 * Route request to appropriate model
 */
export async function routeRequest(
  request: ModelRequest
): Promise<ModelResponse> {
  try {
    const model = request.modelPreference || getBestModelForTask(detectTaskType(request.prompt));
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Azenith Sovereign",
    };

    if (API_KEY) {
      headers["Authorization"] = `Bearer ${API_KEY}`;
    }

    const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          ...(request.systemPrompt ? [{ role: "system", content: request.systemPrompt }] : []),
          { role: "user", content: request.prompt },
        ],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      content: data.choices[0]?.message?.content || "",
      model: data.model || model,
      usage: data.usage,
    };
  } catch (error) {
    console.error("OpenRouter request failed:", error);
    return {
      success: false,
      content: "",
      model: request.modelPreference || "unknown",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get best model for specific task type
 */
export function getBestModelForTask(taskType: string): string {
  return MODEL_PRIORITIES[taskType.toLowerCase()] || MODEL_PRIORITIES.general;
}

/**
 * Detect task type from prompt
 */
function detectTaskType(prompt: string): string {
  const lowerPrompt = prompt.toLowerCase();
  
  if (/\b(code|programming|function|bug|error|debug|javascript|typescript|python|html|css|react|node)\b/.test(lowerPrompt)) {
    return "coding";
  }
  
  if (/\b(translate|translation|language|arabic|english|french|german|chinese)\b/.test(lowerPrompt)) {
    return "translation";
  }
  
  if (/\b(image|picture|photo|vision|see|look|visual|analyze image)\b/.test(lowerPrompt)) {
    return "vision";
  }
  
  if (/\b(write|creative|story|poem|blog|article|content|marketing)\b/.test(lowerPrompt)) {
    return "creative";
  }
  
  if (/\b(analyze|analysis|report|data|statistics|metrics|research)\b/.test(lowerPrompt)) {
    return "analysis";
  }
  
  if (/\b(plan|strategy|roadmap|schedule|timeline|organize)\b/.test(lowerPrompt)) {
    return "planning";
  }
  
  if (/\b(security|vulnerability|threat|audit|pentest|hack)\b/.test(lowerPrompt)) {
    return "security";
  }
  
  return "general";
}

/**
 * Fallback models when API is unavailable
 */
function getFallbackModels(): OpenRouterModel[] {
  return [
    {
      id: "meta-llama/llama-3.1-8b-instruct",
      name: "Llama 3.1 8B",
      description: "General purpose model",
      context_length: 128000,
      pricing: { prompt: 0, completion: 0 },
      top_provider: "Meta",
    },
    {
      id: "mistralai/mistral-7b-instruct-v0.3",
      name: "Mistral 7B",
      description: "Fast and efficient",
      context_length: 32768,
      pricing: { prompt: 0, completion: 0 },
      top_provider: "Mistral",
    },
    {
      id: "deepseek/deepseek-coder-v2",
      name: "DeepSeek Coder V2",
      description: "Coding specialist",
      context_length: 128000,
      pricing: { prompt: 0, completion: 0 },
      top_provider: "DeepSeek",
    },
    {
      id: "anthropic/claude-3.5-haiku",
      name: "Claude 3.5 Haiku",
      description: "Fast Claude model",
      context_length: 200000,
      pricing: { prompt: 0, completion: 0 },
      top_provider: "Anthropic",
    },
    {
      id: "moonshotai/kimi-k2",
      name: "Kimi K2",
      description: "Planning and analysis",
      context_length: 256000,
      pricing: { prompt: 0, completion: 0 },
      top_provider: "Moonshot AI",
    },
  ];
}

/**
 * Batch process multiple requests
 */
export async function batchRouteRequests(
  requests: ModelRequest[]
): Promise<ModelResponse[]> {
  return Promise.all(requests.map(routeRequest));
}

/**
 * Stream response from model
 */
export async function* streamRequest(
  request: ModelRequest
): AsyncGenerator<string, void, unknown> {
  try {
    const model = request.modelPreference || getBestModelForTask(detectTaskType(request.prompt));
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Azenith Sovereign",
    };

    if (API_KEY) {
      headers["Authorization"] = `Bearer ${API_KEY}`;
    }

    const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          ...(request.systemPrompt ? [{ role: "system", content: request.systemPrompt }] : []),
          { role: "user", content: request.prompt },
        ],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2048,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error("Streaming failed");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter(line => line.trim() !== "");
      
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") return;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
  } catch (error) {
    console.error("Streaming error:", error);
    yield "Error: Streaming failed";
  }
}
