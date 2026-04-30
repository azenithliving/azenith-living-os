import { config } from "dotenv";
config({ path: ".env.local" });

import { routeRequest } from "./lib/openrouter-service";

async function test() {
  console.log("Key:", process.env.OPENROUTER_KEYS ? "EXISTS" : "MISSING");
  const OPENROUTER_API_URL = "https://openrouter.ai/api/v1";
  const API_KEY = process.env.OPENROUTER_API_KEY || (process.env.OPENROUTER_KEYS ? process.env.OPENROUTER_KEYS.split(',')[0] : "");
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "Azenith Sovereign",
  };

  if (API_KEY) {
    headers["Authorization"] = `Bearer ${API_KEY}`;
  }

  const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "meta-llama/llama-3.3-70b-instruct:free",
      messages: [{ role: "user", content: "Hello" }]
    }),
  });

  console.log("Status:", response.status);
  const data = await response.text();
  console.log("Body:", data.substring(0, 200));
}

test();
