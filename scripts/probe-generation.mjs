/**
 * Who can actually write, not just answer a hello.
 *
 * A key that returns its model list is «alive», and that is what the desk counts — measured
 * tonight, one provider passed the list and refused to generate for lack of paid credit. So
 * this asks each company one tiny completion with one live key and reports the shape of the
 * answer. Keys are never printed; only the provider, the verdict and the reason's first words.
 *
 * Usage: node scripts/probe-generation.mjs
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import postgres from "postgres";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local") });
const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL, { ssl: "require", max: 1 });

const CALLS = {
  groq: (k) => ["https://api.groq.com/openai/v1/chat/completions", { headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: "قل نعم" }], max_tokens: 4 }) }],
  google: (k) => [`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${k}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: "قل نعم" }] }], generationConfig: { maxOutputTokens: 4 } }) }],
  openrouter: (k) => ["https://openrouter.ai/api/v1/chat/completions", { headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "meta-llama/llama-3.3-70b-instruct:free", messages: [{ role: "user", content: "قل نعم" }], max_tokens: 4 }) }],
  cerebras: (k) => ["https://api.cerebras.ai/v1/chat/completions", { headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-oss-120b", messages: [{ role: "user", content: "قل نعم" }], max_tokens: 4 }) }],
  together: (k) => ["https://api.together.xyz/v1/chat/completions", { headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free", messages: [{ role: "user", content: "قل نعم" }], max_tokens: 4 }) }],
  sambanova: (k) => ["https://api.sambanova.ai/v1/chat/completions", { headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "DeepSeek-V3.2", messages: [{ role: "user", content: "قل نعم" }], max_tokens: 4 }) }],
  anthropic: (k) => ["https://api.anthropic.com/v1/messages", { headers: { "x-api-key": k, "anthropic-version": "2023-06-01", "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 4, messages: [{ role: "user", content: "قل نعم" }] }) }],
  openai: (k) => ["https://api.openai.com/v1/chat/completions", { headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-4.1-nano", messages: [{ role: "user", content: "قل نعم" }], max_tokens: 4 }) }],
  cohere: (k) => ["https://api.cohere.com/v2/chat", { headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "command-a-03-2025", messages: [{ role: "user", content: "قل نعم" }], max_tokens: 4 }) }],
  mistral: (k) => ["https://api.mistral.ai/v1/chat/completions", { headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "mistral-small-latest", messages: [{ role: "user", content: "قل نعم" }], max_tokens: 4 }) }],
  deepseek: (k) => ["https://api.deepseek.com/chat/completions", { headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "user", content: "قل نعم" }], max_tokens: 4 }) }],
  aimlapi: (k) => ["https://api.aimlapi.com/v1/chat/completions", { headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "meta-llama/llama-3.3-70b-instruct", messages: [{ role: "user", content: "قل نعم" }], max_tokens: 4 }) }],
};

const shape = (text) => String(text ?? "").replace(/[A-Za-z0-9_\-]{16,}/g, "‹token›").replace(/\s+/g, " ").slice(0, 90);

for (const [provider, make] of Object.entries(CALLS)) {
  // One key proves nothing: the pool is large and a single row can be a typo. Three are
  // asked, and the provider's capacity is reported as «how many of the three wrote».
  const rows = await sql`select key from public.api_keys where provider = ${provider} and is_active = true and coalesce(check_state,'x') <> 'dead' order by last_used_at nulls first limit 3`;
  if (!rows.length) { console.log(provider.padEnd(12), "— no live key to ask with"); continue; }
  let wrote = 0;
  const reasons = new Set();
  for (const row of rows) {
    const [url, init] = make(row.key);
    const started = Date.now();
    try {
      const res = await fetch(url, { method: "POST", signal: AbortSignal.timeout(25000), ...init });
      const body = await res.text();
      if (res.status === 200 && !/"error"/.test(body.slice(0, 200))) { wrote++; continue; }
      reasons.add(`${res.status} ` + shape(JSON.parse(body || "{}")?.error?.message ?? body).slice(0, 60));
    } catch (error) {
      reasons.add("no answer " + shape(error?.message).slice(0, 50));
    }
  }
  console.log(provider.padEnd(12), `wrote ${wrote}/${rows.length}`, [...reasons].join(" | ") || "—");
}
await sql.end();
