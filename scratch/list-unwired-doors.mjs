/** Print the doors that call a model and do not fall to a declared floor. */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const CALLS = /\b(askAI|askVision|askVisionAny|askGroq|askOpenRouter|askCohere|askGoogle|askGemini|askAnthropic|askOpenAI|askSambaNova|askTogether|askCerebras|askMistral|askDeepSeek|generateText|streamText|callModel|runAgent|orchestrate)\b|api\.groq\.com|openrouter\.ai|generativelanguage\.googleapis\.com|api\.together\.xyz|api\.cerebras\.net|api\.anthropic\.com|api\.openai\.com|api\.nvidia\.com|api\.chutes\.ai/;
const FLOOR = /askWithFloor|modelFloorLine|capability-tiers/;

function src(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return src(full);
    return /\.ts$/.test(entry) && !entry.includes(".test.") ? [full] : [];
  });
}

const all = src("app/api").filter((f) => CALLS.test(readFileSync(f, "utf8"))).map((f) => f.replace(/\\/g, "/")).sort();
console.log("doors calling a model:", all.length);
const unwired = all.filter((f) => !FLOOR.test(readFileSync(f, "utf8")));
console.log("unwired:", unwired.length);
for (const f of unwired) console.log(`  "${f}",`);
