/**
 * Gemini Proxy Client
 * Routes requests through Vercel API to bypass Egypt IP restrictions
 * Falls back to direct API when proxy is unavailable
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

const PROXY_URL = "https://azenith-living-os.vercel.app/api/proxy/gemini";

// Load Gemini keys for fallback
const GEMINI_KEYS = (process.env.GOOGLE_AI_KEYS || "").split(",").filter(Boolean);
let currentKeyIndex = 0;

interface GeminiProxyResponse {
  success: boolean;
  text?: string;
  error?: string;
  shouldRotateKey?: boolean;
}

// Direct API fallback
async function analyzeWithDirectAPI(
  prompt: string,
  imageUrl: string
): Promise<{ score: number; error?: string }> {
  try {
    const key = GEMINI_KEYS[currentKeyIndex % GEMINI_KEYS.length];
    if (!key) {
      return { score: 0, error: "No Gemini keys available" };
    }

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Fetch image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return { score: 0, error: "Failed to fetch image" };
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: "image/jpeg",
        },
      },
    ]);

    const text = result.response.text().trim();
    const score = parseInt(text.match(/\d+/)?.[0] || "0");

    return { score: Math.min(100, Math.max(0, score)) };

  } catch (error: any) {
    // If key expired, try next key
    if (error.message?.includes("API_KEY_INVALID") || error.message?.includes("expired")) {
      currentKeyIndex++;
      console.log(`[Gemini] Key ${currentKeyIndex} expired, trying next...`);
      return analyzeWithDirectAPI(prompt, imageUrl);
    }
    return { score: 0, error: (error as Error).message };
  }
}

// OpenRouter Fallback
async function analyzeWithOpenRouter(
  imageUrl: string,
  category: string,
  style: string
): Promise<{ score: number; error?: string }> {
  try {
    const OPENROUTER_KEYS = (process.env.OPENROUTER_KEYS || "").split(",").filter(Boolean);
    const key = OPENROUTER_KEYS[Math.floor(Math.random() * OPENROUTER_KEYS.length)];
    
    if (!key) {
      return { score: 0, error: "No OpenRouter keys available" };
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://azenith-living-os.vercel.app",
        "X-Title": "Azenith Living Harvester",
      },
      body: JSON.stringify({
        model: "google/gemini-flash-1.5",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: `Rate this ${category} in ${style} style (0-100 quality). Return ONLY the number.` },
              { type: "image_url", image_url: { url: imageUrl } }
            ]
          }
        ]
      }),
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "0";
    const score = parseInt(text.match(/\d+/)?.[0] || "0");
    
    console.log(`[OpenRouter] Success! Score: ${score}`);
    return { score: Math.min(100, Math.max(0, score)) };
  } catch (error) {
    return { score: 0, error: `OpenRouter failed: ${(error as Error).message}` };
  }
}

// Groq Fallback for Image Analysis
async function analyzeWithGroq(
  imageUrl: string,
  category: string,
  style: string
): Promise<{ score: number; error?: string }> {
  try {
    const GROQ_KEYS = (process.env.GROQ_KEYS || "").split(",").filter(Boolean);
    const key = GROQ_KEYS[Math.floor(Math.random() * GROQ_KEYS.length)];
    
    if (!key) return analyzeWithOpenRouter(imageUrl, category, style);

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.2-90b-vision-preview", // Updated to 90b
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this interior design for a ${category} in ${style} style. Rate quality & match 0-100. Respond with ONLY the number.`,
              },
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq status ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices[0]?.message?.content || "0";
    const score = parseInt(text.match(/\d+/)?.[0] || "0");

    console.log(`[Groq] Success! Score: ${score}`);
    return { score: Math.min(100, Math.max(0, score)) };
  } catch (error) {
    console.log(`[Groq] Failed, trying OpenRouter...`);
    return analyzeWithOpenRouter(imageUrl, category, style);
  }
}

export async function analyzeImageWithProxy(
  prompt: string,
  imageUrl: string,
  keyIndex: number = 0,
  category: string = "interior",
  style: string = "luxury"
): Promise<{ score: number; error?: string }> {
  try {
    const response = await fetch(PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        imageUrl,
        keyIndex,
      }),
    });

    const data: GeminiProxyResponse = await response.json();

    if (!response.ok || !data.success) {
      console.log(`[Gemini] Proxy failed, falling back to Groq...`);
      return analyzeWithGroq(imageUrl, category, style);
    }

    const text = data.text || "0";
    const score = parseInt(text.match(/\d+/)?.[0] || "0");

    return { score: Math.min(100, Math.max(0, score)) };

  } catch (error) {
    console.log(`[Gemini] Proxy unavailable, falling back to Groq...`);
    return analyzeWithGroq(imageUrl, category, style);
  }
}

export async function checkProxyHealth(): Promise<{
  ok: boolean;
  availableKeys?: number;
  error?: string;
}> {
  try {
    const response = await fetch(PROXY_URL, { method: "GET" });
    const data = await response.json();
    
    return {
      ok: response.ok,
      availableKeys: data.availableKeys,
    };
  } catch (error) {
    return {
      ok: false,
      error: (error as Error).message,
    };
  }
}
