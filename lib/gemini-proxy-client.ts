/**
 * THE ULTIMATE ARSENAL: Multi-Provider AI Engine (131+ Keys)
 * Dynamic Key Loading & Live Model Routing (gemini-3.6-flash)
 */

import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Ensure environment variables are loaded immediately
dotenv.config({ path: ".env.local" });
dotenv.config();

function getEnvKeys(name: string): string[] {
  return (process.env[name] || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

// Cached keys with periodic refresh
let cachedGeminiKeys: string[] = [];
let cachedOpenRouterKeys: string[] = [];
let lastKeyFetchTime = 0;
const keyCooldowns = new Map<string, number>();

async function loadActiveKeys(): Promise<{ gemini: string[]; openrouter: string[] }> {
  const now = Date.now();
  if (now - lastKeyFetchTime < 60000 && (cachedGeminiKeys.length > 0 || cachedOpenRouterKeys.length > 0)) {
    return { gemini: cachedGeminiKeys, openrouter: cachedOpenRouterKeys };
  }

  // 1. Load from environment (filter valid AIzaSy keys for Google AI Studio)
  let gemini = getEnvKeys("GOOGLE_AI_KEYS").filter((k) => k.startsWith("AIzaSy"));
  let openrouter = getEnvKeys("OPENROUTER_KEYS");

  // 2. Load from Supabase database to ensure maximum key arsenal
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && serviceRoleKey && serviceRoleKey !== "placeholder-service-key") {
      const supabase = createClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: dbKeys, error } = await supabase
        .from("api_keys")
        .select("provider, key")
        .eq("is_active", true);

      if (dbKeys && dbKeys.length > 0) {
        const dbGemini = dbKeys
          .filter((r) => r.provider === "gemini" || r.provider === "google")
          .map((r) => r.key.trim())
          .filter((k) => k.startsWith("AIzaSy"));

        const dbOR = dbKeys
          .filter((r) => r.provider === "openrouter")
          .map((r) => r.key.trim())
          .filter(Boolean);

        if (dbGemini.length > 0) {
          gemini = Array.from(new Set([...gemini, ...dbGemini]));
        }
        if (dbOR.length > 0) {
          openrouter = Array.from(new Set([...openrouter, ...dbOR]));
        }
      } else if (error) {
        console.warn("[Arsenal] Supabase key fetch warning:", error.message);
      }
    }
  } catch (err: any) {
    console.warn("[Arsenal] DB key load exception:", err.message);
  }

  cachedGeminiKeys = gemini;
  cachedOpenRouterKeys = openrouter;
  lastKeyFetchTime = now;

  console.log(`[Arsenal Loaded] Active AIzaSy Gemini: ${gemini.length} | OpenRouter: ${openrouter.length}`);
  return { gemini, openrouter };
}

let geminiIdx = 0;
let orIdx = 0;

type ImageAnalysisResult = {
  score: number;
  error?: string;
};

/**
 * Image to Base64 with timeout
 */
async function getBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString("base64");
  } catch (_) {
    return null;
  }
}

/**
 * Main Analysis Orchestrator
 */
export async function analyzeImage(imageUrl: string, category: string, style: string): Promise<ImageAnalysisResult> {
  const cleanCategory = category.replace(/-/g, " ");
  const strictPrompt = `You are an elite interior design quality inspector. 
CRITICAL TASK: Evaluate this image.
1. Is it a high-end, professional, luxury interior design shot? (Must NOT contain people, text, messy rooms, bad lighting, or AI artifacts). If NO, return 0 immediately.
2. If YES (it is a beautiful interior), does it perfectly match a luxury ${style} ${cleanCategory}?
- If it PERFECTLY matches BOTH the room type (${cleanCategory}) and style (${style}), return a score between 85 and 100.
- If it is a gorgeous luxury interior shot, but it DOES NOT match the specific room or style (e.g. it's a living room instead of a bedroom), return 50.
Return ONLY the integer number. No words, no symbols, nothing else.`;

  const { gemini, openrouter } = await loadActiveKeys();

  const base64Data = await getBase64(imageUrl);
  if (!base64Data) {
    console.warn(`[Image Analyzer] Could not fetch image data for ${imageUrl.slice(0, 50)}...`);
    return { score: 0, error: "FETCH_IMAGE_FAILED" };
  }

  // Gemini model cascade (fastest & most stable first)
  const geminiModels = [
    "gemini-3.1-flash-lite",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3-flash-preview",
  ];

  // Try up to 15 key attempts across active Gemini keys
  const maxGeminiAttempts = Math.min(20, gemini.length);
  for (let attempt = 0; attempt < maxGeminiAttempts; attempt++) {
    if (gemini.length === 0) break;

    const now = Date.now();
    const key = gemini[geminiIdx++ % gemini.length];

    // Skip key if cooling down from recent 429
    if ((keyCooldowns.get(key) || 0) > now) {
      continue;
    }

    for (const model of geminiModels) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(10000),
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: strictPrompt },
                    { inline_data: { mime_type: "image/jpeg", data: base64Data } },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 150,
              },
            }),
          }
        );

        if (response.status === 429) {
          // Rate limit: cool down key for 45 seconds
          keyCooldowns.set(key, Date.now() + 45000);
          break; // Stop trying other models on this rate-limited key
        }

        if (response.status === 503) {
          // Model high demand spike: cool key slightly and try next model
          keyCooldowns.set(key, Date.now() + 15000);
          continue;
        }

        if (!response.ok) continue;

        const data = await response.json();
        if (data.error) continue;

        const parts = data.candidates?.[0]?.content?.parts ?? [];
        const text = parts.map((p: { text?: string }) => p.text).filter(Boolean).join(" ");
        const match = text.match(/\d+/);
        if (match) {
          const score = parseInt(match[0], 10);
          if (score >= 85) console.log(`[Gemini (${model})] Strict Approved | Score: ${score}`);
          else if (score === 50) console.log(`[Gemini (${model})] Redirected to Comprehensive | Score: 50`);
          else console.log(`[Gemini (${model})] REJECTED | Score: ${score}`);
          return { score: Math.min(100, Math.max(0, score)) };
        }
      } catch (_) {
        // Timeout or network error, try next
      }
    }
  }

  // --- 2. OPENROUTER VISION FALLBACK ---
  const orModels = [
    "google/gemma-4-31b-it:free",
    "google/gemma-4-26b-a4b-it:free",
    "nex-agi/nex-n2.5-pro:free",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  ];

  const maxOrAttempts = Math.min(10, openrouter.length);
  for (let attempt = 0; attempt < maxOrAttempts; attempt++) {
    if (openrouter.length === 0) break;

    const key = openrouter[orIdx++ % openrouter.length];
    for (const model of orModels) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://azenith-living.vercel.app",
            "X-Title": "Azenith Living Harvester",
          },
          signal: AbortSignal.timeout(12000),
          body: JSON.stringify({
            model,
            max_tokens: 20,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: strictPrompt },
                  { type: "image_url", image_url: { url: imageUrl } },
                ],
              },
            ],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const text = data.choices?.[0]?.message?.content || "";
          const match = text.match(/\d+/);
          if (match) {
            const score = parseInt(match[0], 10);
            if (score >= 85) console.log(`[OpenRouter (${model})] Strict Approved | Score: ${score}`);
            else if (score === 50) console.log(`[OpenRouter (${model})] Redirected to Comprehensive | Score: 50`);
            else console.log(`[OpenRouter (${model})] REJECTED | Score: ${score}`);
            return { score: Math.min(100, Math.max(0, score)) };
          }
        }
      } catch (_) {
        // Continue
      }
    }
  }

  console.log(`🚫 API FAILED: All providers exhausted without valid response.`);
  return { score: 0, error: "ALL_PROVIDERS_EXHAUSTED" };
}

export async function analyzeImageWithProxy(
  prompt: string,
  imageUrl: string,
  keyIndex: number = 0,
  category: string = "interior",
  style: string = "luxury"
) {
  return analyzeImage(imageUrl, category, style);
}

export async function checkProxyHealth() {
  const { gemini, openrouter } = await loadActiveKeys();
  return { ok: gemini.length > 0 || openrouter.length > 0, totalArmy: gemini.length + openrouter.length };
}
