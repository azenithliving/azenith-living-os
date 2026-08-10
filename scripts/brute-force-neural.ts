import fs from 'fs';
import path from 'path';

async function bruteForce() {
  console.log("🔨 Starting Brute-Force Neural Recovery...");
  
  const envPath = path.join(process.cwd(), '.env.local');
  const content = fs.readFileSync(envPath, 'utf8');
  const orKeysMatch = content.match(/OPENROUTER_KEYS=["']?(.*?)["']?(\r?\n|$)/);
  if (!orKeysMatch) return;
  
  const allKeys = orKeysMatch[1].split(',').map(k => k.replace(/['"]+/g, '').trim()).filter(Boolean);
  const models = [
    "moonshotai/kimi-k2.6",
    "openai/gpt-oss-20b:free",
    "google/gemma-4-26b-a4b-it:free",
    "meta-llama/llama-3.1-8b-instruct",
    "google/gemini-3-flash-preview",
    "openrouter/auto"
  ];

  for (const key of allKeys) {
    for (const model of models) {
      try {
        process.stdout.write(`Trying Key ${key.slice(0,8)}... with ${model}: `);
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://azenith-living.vercel.app",
            "X-Title": "Azenith Recovery"
          },
          body: JSON.stringify({ model, messages: [{ role: "user", content: "hi" }], max_tokens: 5 })
        });
        
        console.log(res.status);
        if (res.ok) {
          const data = await res.json();
          if (data.choices?.[0]) {
            console.log("✅ SUCCESS! Found working combo.");
            console.log("KEY:", key);
            console.log("MODEL:", model);
            return;
          }
        }
      } catch (e) {
        console.log("Error");
      }
    }
  }
  console.log("❌ All combinations failed.");
}

bruteForce();
