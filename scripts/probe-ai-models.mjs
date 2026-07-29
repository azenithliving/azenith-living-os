import { readFileSync } from "node:fs";

function loadEnv(file) {
  const env = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

async function probe(name, url, key) {
  if (!key) {
    console.log(`${name}: no key`);
    return;
  }
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    const json = await response.json().catch(() => ({}));
    const models = Array.isArray(json.data) ? json.data : Array.isArray(json.models) ? json.models : [];
    console.log(`${name}: HTTP ${response.status} ${models.slice(0, 12).map((item) => item.id || item.name || item).join(", ")}`);
  } catch (error) {
    console.log(`${name}: ${error.message}`);
  }
}

const env = loadEnv(".env.local");
await probe("together", "https://api.together.xyz/v1/models", env.TOGETHER_API_KEYS?.split(",")[0]);
await probe("aimlapi", "https://api.aimlapi.com/v1/models", env.AIMLAPI_KEYS?.split(",")[0]);
await probe("cerebras", "https://api.cerebras.ai/v1/models", env.CEREBRAS_API_KEY);
await probe("cohere", "https://api.cohere.ai/v1/models", env.COHERE_API_KEY);
