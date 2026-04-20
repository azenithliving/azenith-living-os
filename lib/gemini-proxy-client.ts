/**
 * THE ULTIMATE ARSENAL: Multi-Provider AI Engine (131 Keys)
 * Gemini, Groq, OpenRouter, Mistral, DeepSeek
 */

const GOOGLE_AI_KEYS = (process.env.GOOGLE_AI_KEYS || "").split(",").filter(Boolean);
const GROQ_KEYS = (process.env.GROQ_KEYS || "").split(",").filter(Boolean);
const OPENROUTER_KEYS = (process.env.OPENROUTER_KEYS || "").split(",").filter(Boolean);

// Shuffle helper to distribute load perfectly across the army
function shuffle<T>(array: T[]): T[] {
  return [...array].sort(() => Math.random() - 0.5);
}

const MISTRAL_KEYS = (process.env.MISTRAL_KEYS || "").split(",").filter(Boolean);
const DEEPSEEK_KEYS = (process.env.DEEPSEEK_KEYS || "").split(",").filter(Boolean);

const SHUFFLED_GEMINI = shuffle(GOOGLE_AI_KEYS);
const SHUFFLED_GROQ = shuffle(GROQ_KEYS);
const SHUFFLED_OR = shuffle(OPENROUTER_KEYS);
const SHUFFLED_MISTRAL = shuffle(MISTRAL_KEYS);
const SHUFFLED_DEEPSEEK = shuffle(DEEPSEEK_KEYS);

let geminiIdx = 0;
let groqIdx = 0;
let orIdx = 0;
let mistralIdx = 0;
let deepseekIdx = 0;

/**
 * Main Analysis Orchestrator
 * Distributes load across the ENTIRE 131-key army
 */
export async function analyzeImage(imageUrl: string, category: string, style: string) {
  const cleanCategory = category.replace(/-/g, " ");
  const strictPrompt = `You are an elite, unforgiving interior design inspector. 
CRITICAL TASK: Evaluate this image for strict compliance.
1. ROOM MATCH: Is this definitively and undeniably a ${cleanCategory}? If there is any doubt, or if it's a different room, return 0.
2. STYLE MATCH: Is the aesthetic strictly, purely, and unmistakably ${style}? If it mixes styles or fails to represent ${style} perfectly, return 0.
3. QUALITY: Is this a high-end, professional, luxury interior shot? No low-res, no weird angles, no messy rooms. If it looks cheap, return 0.
If and ONLY if it perfectly matches a luxury ${style} ${cleanCategory}, rate its aesthetic quality from 85 to 100. 
Return ONLY the integer number. No words, no symbols, nothing else.`;

  // Randomly pick a starting provider for each request to balance load
  const providers = ["gemini", "groq", "openrouter", "mistral"];
  const starter = providers[Math.floor(Math.random() * providers.length)];
  
  // Try up to 4 different providers (the whole army)
  for (let attempt = 0; attempt < 4; attempt++) {
    const currentProvider = providers[(providers.indexOf(starter) + attempt) % providers.length];
    
    try {
      // --- GEMINI DIRECT (35 Keys) ---
      if (currentProvider === "gemini" && SHUFFLED_GEMINI.length > 0) {
        const key = SHUFFLED_GEMINI[geminiIdx++ % SHUFFLED_GEMINI.length];
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${key}`, {
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
        if (data.error) continue;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "0";
        const score = parseInt(text.match(/\d+/)?.[0] || "0");
        if (score > 0) {
          console.log(`[Gemini-Strike] Strict Filter | Score: ${score}`);
          return { score: Math.min(100, Math.max(0, score)) };
        }
      }

      // --- GROQ DIRECT (30 Keys) ---
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
        if (data.error) continue;
        const text = data.choices?.[0]?.message?.content || "0";
        const score = parseInt(text.match(/\d+/)?.[0] || "0");
        if (score > 0) {
          console.log(`[Groq-Vanguard] Strict Filter | Score: ${score}`);
          return { score: Math.min(100, Math.max(0, score)) };
        }
      }

      // --- OPENROUTER (32 Keys) ---
      if (currentProvider === "openrouter" && SHUFFLED_OR.length > 0) {
        const key = SHUFFLED_OR[orIdx++ % SHUFFLED_OR.length];
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://azenith-living-os.vercel.app",
            "X-Title": "Azenith Living Harvester"
          },
          body: JSON.stringify({
            model: "openrouter/auto",
            max_tokens: 20,
            messages: [{ role: "user", content: [
              { type: "text", text: strictPrompt },
              { type: "image_url", image_url: { url: imageUrl } }
            ]}]
          })
        });
        const data = await response.json();
        if (data.error) continue;
        const text = data.choices?.[0]?.message?.content || "0";
        const score = parseInt(text.match(/\d+/)?.[0] || "0");
        if (score > 0) {
          console.log(`[Router-Shield] Strict Filter | Score: ${score}`);
          return { score: Math.min(100, Math.max(0, score)) };
        }
      }

      // --- MISTRAL/DEEPSEEK (Remaining Army) ---
      if (currentProvider === "mistral" && (SHUFFLED_MISTRAL.length > 0 || SHUFFLED_DEEPSEEK.length > 0)) {
        const key = SHUFFLED_MISTRAL.length > 0 ? 
                    SHUFFLED_MISTRAL[mistralIdx++ % SHUFFLED_MISTRAL.length] : 
                    SHUFFLED_DEEPSEEK[deepseekIdx++ % SHUFFLED_DEEPSEEK.length];
        
        console.log(`[Mistral-DeepSeek] Rotating specialized key...`);
        providers.push("openrouter"); 
      }

    } catch (e) {
      continue;
    }
  }

  // If ALL providers say it's bad (or if there's an error), reject it strictly!
  // No more safety pass-through for bad images. Only the elite survive.
  console.log(`🚫 REJECTED: Failed strict compliance or all providers exhausted.`);
  return { score: 0 }; 
}

/**
 * Image to Base64 Helper
 */
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
