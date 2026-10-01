/**
 * Asking the three parked providers, in their own words, what they serve.
 *
 * Model identifiers are not something to remember from training data: they move, and a wrong
 * one costs a request that fails for a reason nobody can see. So this takes one live key from
 * the pool — a key the desk already verified answers — and asks the company's own model list.
 * Only identifiers are printed; a key never is.
 *
 * Usage: node scripts/probe-parked-providers.mjs
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import postgres from "postgres";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local") });

const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL, { ssl: "require", max: 1 });

const ENDPOINTS = {
  sambanova: {
    url: "https://api.sambanova.ai/v1/models",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  openai: {
    url: "https://api.openai.com/v1/models",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  anthropic: {
    url: "https://api.anthropic.com/v1/models",
    headers: (key) => ({ "x-api-key": key, "anthropic-version": "2023-06-01" }),
  },
};

try {
  for (const [provider, endpoint] of Object.entries(ENDPOINTS)) {
    const rows = await sql`
      select key from public.api_keys
       where provider = ${provider} and is_active = true and check_state = 'alive'
       order by random() limit 1`;
    if (!rows.length) {
      console.log(`${provider}: no live key to ask with`);
      continue;
    }
    const started = Date.now();
    try {
      const res = await fetch(endpoint.url, { headers: endpoint.headers(rows[0].key), signal: AbortSignal.timeout(20000) });
      const data = await res.json().catch(() => null);
      const ids = Array.isArray(data?.data) ? data.data.map((m) => m.id ?? m.model) : Array.isArray(data) ? data.map((m) => m.id ?? m.model) : [];
      console.log(`${provider}: http ${res.status} in ${Date.now() - started}ms — ${ids.length} models`);
      console.log(`   ${ids.filter(Boolean).slice(0, 14).join(", ")}`);
    } catch (error) {
      console.log(`${provider}: the list did not answer — ${String(error?.message ?? error).slice(0, 80)}`);
    }
  }
} finally {
  await sql.end();
}
