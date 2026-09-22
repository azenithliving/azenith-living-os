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

async function loadActiveKeys(): Promise<{ gemini: string[]; openrouter: string[] }> {
  const now = Date.now();
  if (now - lastKeyFetchTime < 60000 && (cachedGeminiKeys.length > 0 || cachedOpenRouterKeys.length > 0)) {
    return { gemini: cachedGeminiKeys, openrouter: cachedOpenRouterKeys };
  }

  // 1. Load from environment (filter valid AIzaSy keys for Google AI Studio)
  let gemini = getEnvKeys("GOOGLE_AI_KEYS").filter((k) => k.startsWith("AIzaSy"));
  let openrouter = getEnvKeys("OPENROUTER_KEYS");

  // 2. If env keys are limited, pull from Supabase database
  if (gemini.length < 5 || openrouter.length < 5) {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (url && serviceRoleKey && serviceRoleKey !== "placeholder-service-key") {
        const supabase = createClient(url, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: dbKeys } = await supabase
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
        }
      }
    } catch (_) {
      // Ignore db fetch error and use env
    }
  }

  cachedGeminiKeys = gemini;
  cachedOpenRouterKeys = openrouter;
  lastKeyFetchTime = now;

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
    return { score: 0 };
  }

  // Try up to 6 key attempts across active keys
  for (let attempt = 0; attempt < 6; attempt++) {
    // --- 1. GEMINI DIRECT ---
    if (gemini.length > 0) {
      const key = gemini[geminiIdx++ % gemini.length];
      const models = ["gemini-3.6-flash", "gemini-3.5-flash-lite"];
      for (const model of models) {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: AbortSignal.timeout(8000),
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
                  maxOutputTokens: 250,
                  thinkingConfig: {
                    thinkingBudget: 0,
                  },
                },
              }),
            }
          );

          if (!response.ok) continue;

          const data = await response.json();
          if (data.error) continue;

          // Extract candidate text across all parts
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
          // Try next model or key
        }
      }
    }

    // --- 2. OPENROUTER VISION FALLBACK ---
    if (openrouter.length > 0) {
      const key = openrouter[orIdx++ % openrouter.length];
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://azenith-living.vercel.app",
            "X-Title": "Azenith Living Harvester",
          },
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            model: "google/gemma-4-26b-a4b-it:free",
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
            if (score >= 85) console.log(`[OpenRouter] Strict Approved | Score: ${score}`);
            else if (score === 50) console.log(`[OpenRouter] Redirected to Comprehensive | Score: 50`);
            else console.log(`[OpenRouter] REJECTED | Score: ${score}`);
            return { score: Math.min(100, Math.max(0, score)) };
          }
        }
      } catch (_) {
        // Continue
      }
    }
  }

  console.log(`🚫 API FAILED: All providers exhausted without valid response.`);
  return { score: 0 };
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
