import fs from 'fs';
import path from 'path';

async function diagnose() {
  console.log("🔍 Starting Neural Diagnostic...");
  
  // 1. Read .env.local
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error("❌ .env.local NOT FOUND");
    return;
  }
  
  const content = fs.readFileSync(envPath, 'utf8');
  const orKeysMatch = content.match(/OPENROUTER_KEYS=["']?(.*?)["']?(\r?\n|$)/);
  
  if (!orKeysMatch) {
    console.error("❌ OPENROUTER_KEYS not found in .env.local");
    return;
  }
  
  const allKeys = orKeysMatch[1].split(',').map(k => k.trim());
  console.log(`📡 Found ${allKeys.length} keys.`);
  
  const testKey = allKeys[0].replace(/['"]+/g, '');
  console.log(`🧪 Testing first key (prefix): ${testKey.slice(0, 10)}...`);
  
  try {
    console.log("📂 Fetching available models...");
    const modelsRes = await fetch("https://openrouter.ai/api/v1/models");
    const models = await modelsRes.json();
    const free = models.data.filter((m: any) => m.pricing.prompt === "0").map((m: any) => m.id);
    console.log("🆓 First 10 Free Models:", free.slice(0, 10));

    console.log("🧪 Testing Llama 3.1 8B Free...");
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${testKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Azenith Diagnostic"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.1-8b-instruct:free",
        messages: [{ role: "user", content: "hi" }]
      })
    });
    
    console.log(`📊 Status: ${response.status}`);
    const data = await response.json();
    console.log("📄 Response:", JSON.stringify(data, null, 2));
    
  } catch (err) {
    console.error("💥 Fetch Error:", err);
  }
}

diagnose();
