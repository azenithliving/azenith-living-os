/**
 * Gemini Proxy Client
 * Routes requests through Vercel API to bypass Egypt IP restrictions
 * Falls back to direct API when proxy is unavailable
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

const PROXY_URL = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}/api/proxy/gemini`
  : "http://localhost:3000/api/proxy/gemini";

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

export async function analyzeImageWithProxy(
  prompt: string,
  imageUrl: string,
  keyIndex: number = 0
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
      // Fallback to direct API
      console.log(`[Gemini] Proxy failed, falling back to direct API...`);
      return analyzeWithDirectAPI(prompt, imageUrl);
    }

    // Extract score from response text (0-100)
    const text = data.text || "0";
    const score = parseInt(text.match(/\d+/)?.[0] || "0");

    return { score: Math.min(100, Math.max(0, score)) };

  } catch (error) {
    // Proxy unavailable, use direct API
    console.log(`[Gemini] Proxy unavailable (${(error as Error).message}), using direct API...`);
    return analyzeWithDirectAPI(prompt, imageUrl);
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
