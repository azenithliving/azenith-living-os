/**
 * THE ULTIMATE ARSENAL: Multi-Provider AI Engine (131 Keys)
 * Gemini 1.5 Flash (Vision), Groq Llama-Vision, OpenRouter
 */

const GOOGLE_AI_KEYS = (process.env.GOOGLE_AI_KEYS || "").split(",").filter(Boolean);
const GROQ_KEYS = (process.env.GROQ_KEYS || "").split(",").filter(Boolean);
const OPENROUTER_KEYS = (process.env.OPENROUTER_KEYS || "").split(",").filter(Boolean);

function shuffle<T>(array: T[]): T[] {
  return [...array].sort(() => Math.random() - 0.5);
}

const MISTRAL_KEYS = (process.env.MISTRAL_KEYS || "").split(",").filter(Boolean);
const DEEPSEEK_KEYS = (process.env.DEEPSEEK_KEYS || "").split(",").filter(Boolean);

const SHUFFLED_GEMINI = shuffle(GOOGLE_AI_KEYS);
const SHUFFLED_GROQ = shuffle(GROQ_KEYS);
const SHUFFLED_OR = shuffle(OPENROUTER_KEYS);

let geminiIdx = 0;
let groqIdx = 0;
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

  const providers = ["gemini", "groq", "openrouter"];
  const starter = providers[Math.floor(Math.random() * providers.length)];
  
  for (let attempt = 0; attempt < providers.length; attempt++) {
    const currentProvider = providers[(providers.indexOf(starter) + attempt) % providers.length];
    
    try {
      // 1. --- GEMINI 1.5 FLASH (الرسمي المعتمد للرؤية) ---
      if (currentProvider === "gemini" && SHUFFLED_GEMINI.length > 0) {
        const key = SHUFFLED_GEMINI[geminiIdx++ % SHUFFLED_GEMINI.length];
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
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
          console.warn(`[Gemini] Error:`, data.error?.message || data.error);
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
      }

      // 2. --- GROQ LLAMA-3.2 VISION (موديل الصور الحقيقي لـ Groq) ---
      if (currentProvider === "groq" && SHUFFLED_GROQ.length > 0) {
        const key = SHUFFLED_GROQ[groqIdx++ % SHUFFLED_GROQ.length];
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "llama-3.2-11b-vision-preview",
            messages: [{ role: "user", content: [
              { type: "text", text: strictPrompt },
              { type: "image_url", image_url: { url: imageUrl } }
            ]}],
            max_tokens: 20
          })
        });
        const data = await response.json();
        if (data.error) {
          console.warn(`[Groq] Error:`, data.error?.message || data.error);
          continue;
        }
        const text = data.choices?.[0]?.message?.content || "";
        const match = text.match(/\d+/);
        if (match) {
          const score = parseInt(match[0]);
          if (score >= 85) console.log(`[Groq-Vanguard] Strict Approved | Score: ${score}`);
          else if (score === 50) console.log(`[Groq-Vanguard] Redirected to Comprehensive | Score: 50`);
          else console.log(`[Groq-Vanguard] REJECTED (Strict) | Score: ${score}`);
          return { score: Math.min(100, Math.max(0, score)) };
        }
      }

      // 3. --- OPENROUTER VISION FALLBACK ---
      if (currentProvider === "openrouter" && SHUFFLED_OR.length > 0) {
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
            model: "google/gemini-flash-1.5",
            max_tokens: 20,
            messages: [{ role: "user", content: [
              { type: "text", text: strictPrompt },
              { type: "image_url", image_url: { url: imageUrl } }
            ]}]
          })
        });
        const data = await response.json();
        if (data.error) continue;
        const text = data.choices?.[0]?.message?.content || "";
        const match = text.match(/\d+/);
        if (match) {
          const score = parseInt(match[0]);
          if (score >= 85) console.log(`[Router-Shield] Strict Approved | Score: ${score}`);
          else if (score === 50) console.log(`[Router-Shield] Redirected to Comprehensive | Score: 50`);
          else console.log(`[Router-Shield] REJECTED (Strict) | Score: ${score}`);
          return { score: Math.min(100, Math.max(0, score)) };
        }
      }

    } catch (e) {
      continue;
    }
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
  return { ok: true, totalArmy: GOOGLE_AI_KEYS.length + GROQ_KEYS.length + OPENROUTER_KEYS.length + MISTRAL_KEYS.length + DEEPSEEK_KEYS.length };
}
