/**
 * THE ULTIMATE ARSENAL: Multi-Provider AI Engine (131 Keys)
 * Powered by Gemini 2.5 Flash & Gemini 2.5 Flash-Lite
 */

const GOOGLE_AI_KEYS = (process.env.GOOGLE_AI_KEYS || "").split(",").filter(Boolean);
const OPENROUTER_KEYS = (process.env.OPENROUTER_KEYS || "").split(",").filter(Boolean);

function shuffle<T>(array: T[]): T[] {
  return [...array].sort(() => Math.random() - 0.5);
}

const SHUFFLED_GEMINI = shuffle(GOOGLE_AI_KEYS);
const SHUFFLED_OR = shuffle(OPENROUTER_KEYS);

let geminiIdx = 0;
let orIdx = 0;

type ImageAnalysisResult = {
  score: number;
  error?: string;
};

export async function analyzeImage(imageUrl: string, category: string, style: string): Promise<ImageAnalysisResult> {
  const cleanCategory = category.replace(/-/g, " ");
  const strictPrompt = `You are an elite interior design quality inspector. 
CRITICAL TASK: Evaluate this image.
1. Is it a high-end, professional, luxury interior design shot? (Must NOT contain people, text, messy rooms, bad lighting, or AI artifacts). If NO, return 0 immediately.
2. If YES (it is a beautiful interior), does it perfectly match a luxury ${style} ${cleanCategory}?
- If it PERFECTLY matches BOTH the room type (${cleanCategory}) and style (${style}), return a score between 85 and 100.
- If it is a gorgeous luxury interior shot, but it DOES NOT match the specific room or style (e.g. it's a living room instead of a bedroom), return 50.
Return ONLY the integer number. No words, no symbols, nothing else.`;

  // Models to try in order of priority
  const geminiModels = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

  // 1. --- GEMINI ARMY (35 Keys with Auto-Failover to 2.5) ---
  if (SHUFFLED_GEMINI.length > 0) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const key = SHUFFLED_GEMINI[geminiIdx++ % SHUFFLED_GEMINI.length];
      
      for (const model of geminiModels) {
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: strictPrompt },
                  { inline_data: { mime_type: "image/jpeg", data: await getBase64(imageUrl) } }
                ]
              }]
            })
          });

          const data = await response.json();
          if (data.error) {
            continue;
          }

          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          const match = text.match(/\d+/);
          if (match) {
            const score = parseInt(match[0]);
            if (score >= 85) console.log(`[Gemini-Strike] Strict Approved | Score: ${score}`);
            else if (score === 50) console.log(`[Gemini-Strike] Redirected to Comprehensive | Score: 50`);
            else console.log(`[Gemini-Strike] REJECTED (Strict) | Score: ${score}`);
            return { score: Math.min(100, Math.max(0, score)) };
          }
        } catch (_) {
          continue;
        }
      }
    }
  }

  // 2. --- OPENROUTER FALLBACK ---
  if (SHUFFLED_OR.length > 0) {
    try {
      const key = SHUFFLED_OR[orIdx++ % SHUFFLED_OR.length];
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://azenith-living.vercel.app",
          "X-Title": "Azenith Living Harvester"
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          max_tokens: 20,
          messages: [{ role: "user", content: [
            { type: "text", text: strictPrompt },
            { type: "image_url", image_url: { url: imageUrl } }
          ]}]
        })
      });
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || "";
      const match = text.match(/\d+/);
      if (match) {
        const score = parseInt(match[0]);
        if (score >= 85) console.log(`[Router-Shield] Strict Approved | Score: ${score}`);
        else if (score === 50) console.log(`[Router-Shield] Redirected to Comprehensive | Score: 50`);
        else console.log(`[Router-Shield] REJECTED (Strict) | Score: ${score}`);
        return { score: Math.min(100, Math.max(0, score)) };
      }
    } catch (_) {}
  }

  console.log(`🚫 API FAILED: All providers exhausted without valid response.`);
  return { score: 0 }; 
}

async function getBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

export async function analyzeImageWithProxy(prompt: string, imageUrl: string, keyIndex: number = 0, category: string = "interior", style: string = "luxury") {
  return analyzeImage(imageUrl, category, style);
}

export async function checkProxyHealth() {
  return { ok: true, totalArmy: GOOGLE_AI_KEYS.length + OPENROUTER_KEYS.length };
}
