import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "API_KEYS_AUDIT.md");
const ENV_FILE_RE = /^\.env($|[.\w-]+)/;
const SKIP_VALIDATE_FILES = new Set([".env.example", ".env.browser-workspace.example"]);

const SECRET_NAME_RE =
  /(API[_-]?KEY|API[_-]?KEYS|TOKEN|SECRET|PASSWORD|DATABASE_URL|DIRECT_URL|REDIS_URL|SUPABASE_URL|UPSTASH_REDIS_REST_URL|BLOB_READ_WRITE_TOKEN|SERVICE_ROLE|ANON_KEY|WEBHOOK_SECRET|OIDC)/i;

const PROVIDERS = [
  ["Supabase", /(SUPABASE|DATABASE_URL|DIRECT_URL)/i],
  ["OpenAI", /OPENAI/i],
  ["Anthropic", /ANTHROPIC/i],
  ["Google Gemini", /(GEMINI|GOOGLE_AI)/i],
  ["Groq", /GROQ/i],
  ["OpenRouter", /OPENROUTER/i],
  ["DeepSeek", /DEEPSEEK/i],
  ["Mistral", /MISTRAL/i],
  ["Hugging Face", /HUGGINGFACE/i],
  ["Pexels", /PEXELS/i],
  ["Cohere", /COHERE/i],
  ["Together AI", /TOGETHER/i],
  ["xAI", /^XAI|_XAI/i],
  ["Cerebras", /CEREBRAS/i],
  ["SambaNova", /SAMBANOVA/i],
  ["AIMLAPI", /AIMLAPI/i],
  ["API Ninjas", /API_NINJAS/i],
  ["Apifreellm", /APIFREELLM/i],
  ["Bytez", /BYTEZ/i],
  ["Cloudflare", /CLOUDFLARE/i],
  ["Upstash Redis", /UPSTASH_REDIS/i],
  ["Redis", /REDIS_URL/i],
  ["Vercel", /(VERCEL|BLOB_READ_WRITE_TOKEN)/i],
  ["PostHog", /POSTHOG/i],
  ["Resend", /RESEND/i],
  ["Telegram", /TELEGRAM/i],
  ["Stripe", /STRIPE/i],
  ["Internal App", /(INTERNAL_API_KEY|CRON_SECRET|VAULT|ADMIN_GATE|DEV_BACKDOOR|NEXT_PUBLIC_NEKO_PASSWORD)/i],
];

function providerFor(key) {
  return PROVIDERS.find(([, re]) => re.test(key))?.[0] ?? "Other / Unclassified";
}

function parseEnv(content, file) {
  const rows = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2].trim();
    if (!SECRET_NAME_RE.test(key)) continue;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    value = value.replace(/\\n/g, "\n").trim();
    if (!value || /^(your_|placeholder|change-me|changeme|xxx|test)$/i.test(value)) {
      rows.push({ file, key, provider: providerFor(key), value, placeholder: true });
      continue;
    }
    for (const singleValue of splitMaybePool(key, value)) {
      rows.push({ file, key, provider: providerFor(key), value: singleValue, placeholder: false });
    }
  }
  return rows;
}

function splitMaybePool(key, value) {
  const pooled =
    /(^|_)(KEYS|API_KEYS|TOKENS)$/i.test(key) ||
    ["GROQ_KEYS", "OPENROUTER_KEYS", "DEEPSEEK_KEYS", "MISTRAL_KEYS", "GOOGLE_AI_KEYS"].includes(key);
  if (!pooled) return [value];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function fingerprint(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function mask(value) {
  if (!value) return "(empty)";
  const compact = value.replace(/\s+/g, "");
  if (compact.length <= 12) return `${compact.slice(0, 2)}...${compact.slice(-2)}`;
  return `${compact.slice(0, 6)}...${compact.slice(-4)}`;
}

function dedupe(rows) {
  const byValue = new Map();
  for (const row of rows) {
    const id = `${row.key}|${fingerprint(row.value)}`;
    const existing = byValue.get(id);
    if (existing) {
      existing.files.add(row.file);
    } else {
      byValue.set(id, {
        ...row,
        files: new Set([row.file]),
        fp: row.value ? fingerprint(row.value) : "empty",
      });
    }
  }
  return [...byValue.values()].sort((a, b) =>
    `${a.provider}:${a.key}:${a.fp}`.localeCompare(`${b.provider}:${b.key}:${b.fp}`),
  );
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    return { status: response.status, ok: response.ok, text: text.slice(0, 300) };
  } catch (error) {
    return { status: 0, ok: false, text: error?.message ?? String(error) };
  } finally {
    clearTimeout(timer);
  }
}

async function validate(item, allItems) {
  if (item.placeholder) return result("skipped", "placeholder/sample value");
  if ([...item.files].every((file) => SKIP_VALIDATE_FILES.has(file))) {
    return result("skipped", "example file only");
  }

  const key = item.key;
  const value = item.value;
  const authHeaders = { Authorization: `Bearer ${value}` };

  if (/^(GROQ_API_KEY|GROQ_KEYS|GROQ_API_KEYS)$/i.test(key)) {
    return statusFrom(await fetchJson("https://api.groq.com/openai/v1/models", { headers: authHeaders }));
  }
  if (/OPENROUTER/i.test(key)) {
    return statusFrom(await fetchJson("https://openrouter.ai/api/v1/auth/key", { headers: authHeaders }));
  }
  if (/DEEPSEEK/i.test(key)) {
    return statusFrom(await fetchJson("https://api.deepseek.com/models", { headers: authHeaders }));
  }
  if (/MISTRAL/i.test(key)) {
    return statusFrom(await fetchJson("https://api.mistral.ai/v1/models", { headers: authHeaders }));
  }
  if (/OPENAI/i.test(key)) {
    return statusFrom(await fetchJson("https://api.openai.com/v1/models", { headers: authHeaders }));
  }
  if (/AIMLAPI/i.test(key)) {
    return statusFrom(await fetchJson("https://api.aimlapi.com/v1/models", { headers: authHeaders }));
  }
  if (/CEREBRAS/i.test(key)) {
    return statusFrom(await fetchJson("https://api.cerebras.ai/v1/models", { headers: authHeaders }));
  }
  if (/COHERE/i.test(key)) {
    return statusFrom(await fetchJson("https://api.cohere.ai/v1/models", { headers: authHeaders }));
  }
  if (/TOGETHER/i.test(key)) {
    return statusFrom(await fetchJson("https://api.together.xyz/v1/models", { headers: authHeaders }));
  }
  if (/^XAI|_XAI/i.test(key)) {
    return statusFrom(await fetchJson("https://api.x.ai/v1/models", { headers: authHeaders }));
  }
  if (/SAMBANOVA/i.test(key)) {
    return statusFrom(await fetchJson("https://api.sambanova.ai/v1/models", { headers: authHeaders }));
  }
  if (/API_NINJAS/i.test(key)) {
    return statusFrom(
      await fetchJson("https://api.api-ninjas.com/v1/city?name=Cairo", {
        headers: { "X-Api-Key": value },
      }),
    );
  }
  if (/ANTHROPIC/i.test(key)) {
    return statusFrom(
      await fetchJson("https://api.anthropic.com/v1/models", {
        headers: { "x-api-key": value, "anthropic-version": "2023-06-01" },
      }),
    );
  }
  if (/(GEMINI|GOOGLE_AI)/i.test(key)) {
    return statusFrom(await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(value)}`));
  }
  if (/HUGGINGFACE/i.test(key)) {
    return statusFrom(await fetchJson("https://huggingface.co/api/whoami-v2", { headers: authHeaders }));
  }
  if (/PEXELS/i.test(key)) {
    return statusFrom(
      await fetchJson("https://api.pexels.com/v1/search?query=interior&per_page=1", {
        headers: { Authorization: value },
      }),
    );
  }
  if (/RESEND/i.test(key)) {
    return statusFrom(await fetchJson("https://api.resend.com/domains", { headers: authHeaders }));
  }
  if (/TELEGRAM_BOT_TOKEN/i.test(key)) {
    return statusFrom(await fetchJson(`https://api.telegram.org/bot${value}/getMe`));
  }
  if (/^(DATABASE_URL|DIRECT_URL)$/i.test(key)) {
    return validatePostgres(value);
  }
  if (/^REDIS_URL$/i.test(key)) {
    return validateRedis(value);
  }
  if (/STRIPE_SECRET_KEY/i.test(key)) {
    return statusFrom(await fetchJson("https://api.stripe.com/v1/account", { headers: authHeaders }));
  }
  if (/UPSTASH_REDIS_REST_TOKEN/i.test(key)) {
    const urlItem = allItems.find((candidate) => /UPSTASH_REDIS_REST_URL/i.test(candidate.key));
    if (!urlItem) return result("skipped", "missing UPSTASH_REDIS_REST_URL for token test");
    return statusFrom(
      await fetchJson(`${urlItem.value.replace(/\/$/, "")}/ping`, {
        headers: { Authorization: `Bearer ${value}` },
      }),
    );
  }
  if (/NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY/i.test(key)) {
    const urlItem = allItems.find((candidate) => /NEXT_PUBLIC_SUPABASE_URL/i.test(candidate.key));
    if (!urlItem) return result("skipped", "missing NEXT_PUBLIC_SUPABASE_URL for Supabase key test");
    return statusFrom(
      await fetchJson(`${urlItem.value.replace(/\/$/, "")}/rest/v1/`, {
        headers: { apikey: value, Authorization: `Bearer ${value}` },
      }),
    );
  }
  if (/CLOUDFLARE_API_TOKEN/i.test(key)) {
    return statusFrom(await fetchJson("https://api.cloudflare.com/client/v4/user/tokens/verify", { headers: authHeaders }));
  }

  return result("not-tested", "no safe generic validation endpoint configured");
}

async function validatePostgres(connectionString) {
  let sql;
  try {
    const postgres = (await import("postgres")).default;
    sql = postgres(connectionString, {
      max: 1,
      connect_timeout: 10,
      idle_timeout: 1,
      ssl: connectionString.includes("localhost") ? undefined : "require",
    });
    await sql`select 1 as ok`;
    return result("active", "SELECT 1 succeeded");
  } catch (error) {
    return result("invalid-or-unreachable", cleanError(error));
  } finally {
    if (sql) await sql.end({ timeout: 1 }).catch(() => {});
  }
}

async function validateRedis(connectionString) {
  let Redis;
  let client;
  try {
    Redis = (await import("ioredis")).default;
    const isTls = connectionString.startsWith("rediss:");
    client = new Redis(connectionString, {
      lazyConnect: true,
      connectTimeout: 10000,
      commandTimeout: 10000,
      maxRetriesPerRequest: 0,
      tls: isTls ? { rejectUnauthorized: false } : undefined,
      family: 0,
    });
    await client.connect();
    const pong = await client.ping();
    return result(pong === "PONG" ? "active" : "unknown", `PING returned ${pong}`);
  } catch (error) {
    return result("invalid-or-unreachable", cleanError(error));
  } finally {
    if (client) client.disconnect();
  }
}

function cleanError(error) {
  const message = error?.message ?? String(error);
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://[redacted]").slice(0, 180);
}

function statusFrom(response) {
  if (response.ok) return result("active", `HTTP ${response.status}`);
  if (response.status === 400 && /api key|invalid|unauthorized/i.test(response.text)) {
    return result("invalid-or-unauthorized", `HTTP ${response.status}`);
  }
  if ([401, 403].includes(response.status)) return result("invalid-or-unauthorized", `HTTP ${response.status}`);
  if ([429].includes(response.status)) return result("rate-limited", `HTTP ${response.status}`);
  if (response.status === 0) return result("error", response.text);
  return result("unknown", `HTTP ${response.status}`);
}

function result(status, note) {
  return { status, note };
}

function mdEscape(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function summarize(items) {
  const counts = new Map();
  for (const item of items) {
    counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([status, count]) => `- ${status}: ${count}`)
    .join("\n");
}

async function main() {
  const files = (await readdir(ROOT)).filter((name) => ENV_FILE_RE.test(name));
  const rows = [];
  for (const file of files) {
    rows.push(...parseEnv(await readFile(path.join(ROOT, file), "utf8"), file));
  }

  const items = dedupe(rows);
  for (const item of items) {
    const validation = await validate(item, items);
    item.status = validation.status;
    item.note = validation.note;
  }

  const providers = new Map();
  for (const item of items) {
    if (!providers.has(item.provider)) providers.set(item.provider, []);
    providers.get(item.provider).push(item);
  }

  const lines = [
    "# API Keys Audit",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "Secrets are intentionally redacted. Use the fingerprint column to match duplicate values without exposing the full key.",
    "",
    "## Summary",
    "",
    `- Env files scanned: ${files.join(", ")}`,
    `- Unique key/value entries: ${items.length}`,
    summarize(items),
    "",
  ];

  for (const [provider, providerItems] of [...providers.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`## ${provider}`, "");
    lines.push("| Variable | Masked value | Fingerprint | Files | Status | Note |");
    lines.push("| --- | --- | --- | --- | --- | --- |");
    for (const item of providerItems) {
      lines.push(
        `| ${mdEscape(item.key)} | ${mdEscape(mask(item.value))} | ${item.fp} | ${mdEscape([...item.files].sort().join(", "))} | ${item.status} | ${mdEscape(item.note)} |`,
      );
    }
    lines.push("");
  }

  await writeFile(OUT, `${lines.join("\n")}\n`, "utf8");
  console.log(`Wrote ${OUT}`);
  console.log(`Unique key/value entries: ${items.length}`);
  console.log(summarize(items));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
