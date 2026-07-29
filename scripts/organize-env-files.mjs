import { copyFile, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const STAMP = new Date().toISOString().replace(/[:.]/g, "-");

const FILES = [".env.local", ".env", ".env.vercel", ".env.vercel.local", ".env.vercel.tmp"].filter((file) =>
  existsSync(path.join(ROOT, file)),
);

const GROUPS = [
  ["Brand and Site", [
    "PROJECT_NAME", "BRAND_NAME", "BRAND_NAME_AR", "PRIMARY_DOMAIN", "NEXT_PUBLIC_URL",
    "NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_APP_URL", "LOGO_URL", "FAVICON_URL",
    "BRAND_PRIMARY_COLOR", "BRAND_SECONDARY_COLOR", "BRAND_ACCENT_COLOR",
    "VISUAL_DIRECTION", "PREFERRED_FONT_STYLE", "DEFAULT_LOCALE", "TIMEZONE",
  ]],
  ["Public Supabase and Database", [
    "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_PROJECT_REF", "DATABASE_URL", "DIRECT_URL",
  ]],
  ["AI Routing", [
    "DEFAULT_AI_PROVIDER", "FALLBACK_AI_PROVIDER_1", "FALLBACK_AI_PROVIDER_2",
    "FALLBACK_AI_PROVIDER_3", "ENABLE_MULTI_MODEL_INTELLIGENCE", "MAX_RETRIES",
  ]],
  ["AI Key Pools", [
    "GROQ_KEYS", "GROQ_MODEL", "OPENROUTER_KEYS", "OPENROUTER_VISION_MODEL",
    "MISTRAL_KEYS", "MISTRAL_CODE_MODEL", "DEEPSEEK_KEYS", "DEEPSEEK_MODEL",
    "TOGETHER_API_KEYS", "TOGETHER_MODEL", "AIMLAPI_KEYS", "AIMLAPI_MODEL",
    "CEREBRAS_API_KEY", "CEREBRAS_MODEL", "COHERE_API_KEY", "COHERE_MODEL",
    "OPENAI_KEYS", "ANTHROPIC_KEYS", "GOOGLE_AI_KEYS", "GEMINI_API_KEY",
    "SAMBANOVA_KEYS", "XAI_KEYS", "HUGGINGFACE_KEYS", "HUGGINGFACE_API_KEY",
    "APIFREELLM_KEYS", "BYTEZ_KEYS",
  ]],
  ["Images and Curation", [
    "PEXELS_KEYS", "STOCK_IMAGE_PROVIDER", "STOCK_IMAGE_API_KEY", "PREFERRED_IMAGE_STYLE",
    "NO_IMAGE_CATEGORIES", "POLLINATIONS_ENABLED", "LIBRETTS_ENABLED",
  ]],
  ["Messaging and Notifications", [
    "TELEGRAM_ENABLED", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "RESEND_API_KEY",
    "GMAIL_USER", "GMAIL_APP_PASSWORD", "SMTP_HOST", "SMTP_PORT", "SMTP_USER",
    "SMTP_PASS", "SMTP_SECURE", "EMAIL_FROM",
  ]],
  ["WhatsApp and Contact", [
    "WHATSAPP_DEFAULT_NUMBER", "WHATSAPP_COUNTRY_CODE", "WHATSAPP_DISPLAY_NUMBER",
    "WHATSAPP_TONE", "WHATSAPP_ADMIN_PHONE", "MASTER_ADMIN_WHATSAPP",
    "CONTACT_EMAIL", "CONTACT_PHONE", "BUSINESS_ADDRESS",
  ]],
  ["Commerce and Offers", [
    "BASIC_PRICE", "FULL_PRICE", "PREMIUM_PRICE", "CURRENCY", "FREE_HOOK_OFFER",
    "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
  ]],
  ["Admin and Security", [
    "MASTER_ADMIN_EMAILS", "ADMIN_GATE_EMAIL", "ADMIN_GATE_PASSWORD", "ADMIN_GATE_2FA_SECRET",
    "DEV_BACKDOOR_PASSWORD", "CRON_SECRET", "INTERNAL_API_KEY", "NEXT_PUBLIC_INTERNAL_API_KEY",
    "VAULT_MASTER_KEY", "VAULT_ENCRYPTION_SALT", "SIGNATURE_PRIVATE_KEY", "SIGNATURE_CERT",
  ]],
  ["Cache and Rate Limit", [
    "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "REDIS_URL",
    "RATE_LIMIT_DISABLED", "ENABLE_KEY_MONITORING", "KEY_USAGE_WARNING_PERCENT",
    "KEY_USAGE_CRITICAL_PERCENT", "UPSTASH_REDIS_L1_URL", "UPSTASH_REDIS_L1_TOKEN",
    "UPSTASH_REDIS_L2_URL", "UPSTASH_REDIS_L2_TOKEN",
  ]],
  ["Deployment and Storage", [
    "BLOB_READ_WRITE_TOKEN", "VERCEL_OIDC_TOKEN", "VERCEL_TOKEN", "VERCEL_PROJECT_ID",
    "VERCEL_URL", "VERCEL_ENV", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN",
  ]],
  ["Remote Browser and Devices", [
    "NEXT_PUBLIC_NEKO_URL", "NEXT_PUBLIC_NEKO_PASSWORD", "NEXT_PUBLIC_ANDROID_URL",
    "REMOTE_BROWSER_BASE_URL", "REMOTE_BROWSER_HEALTHCHECK_URL", "REMOTE_BROWSER_LABEL",
    "REMOTE_BROWSER_VNC_PASSWORD", "BROWSER_WORKSPACE_HEALTHCHECK_URL",
    "BROWSER_WORKSPACE_LABEL", "BROWSER_WORKSPACE_VIEWER_URL", "SCRCPY_PATH",
  ]],
  ["Business Settings", [
    "TENANT_MODE", "MASTER_COMPANY_ID", "BOOKING_MODE", "BOOKING_WORKING_HOURS",
    "BOOKING_SLOT_DURATION", "BOOKING_TIMEZONE", "SOVEREIGN_ADMIN_EMAIL",
    "MASTERMIND_MODE", "ENABLE_SELF_EXECUTION", "AACA_ALLOW_REDIS_FAILURE",
    "AACA_CLOUD_MODE", "AACA_PORT", "AACA_SERVICE_URL",
  ]],
  ["External Utilities", [
    "API_NINJAS_KEYS", "APIFY_API_TOKEN", "GOOGLE_PAGESPEED_API_KEY",
  ]],
];

const PREFERRED_VALUES = {
  DEFAULT_AI_PROVIDER: "groq",
  FALLBACK_AI_PROVIDER_1: "openrouter",
  FALLBACK_AI_PROVIDER_2: "mistral",
  FALLBACK_AI_PROVIDER_3: "deepseek",
  ENABLE_MULTI_MODEL_INTELLIGENCE: "true",
  MAX_RETRIES: "3",
};

function parse(content) {
  const map = new Map();
  const unknownComments = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      if (!line.startsWith("# ===")) unknownComments.push(rawLine);
      continue;
    }
    const match = rawLine.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      unknownComments.push(`# Unparsed: ${rawLine}`);
      continue;
    }
    map.set(match[1], match[2].trim());
  }
  return { map, unknownComments };
}

function render(map, header) {
  const used = new Set();
  const lines = [
    "# Organized environment file",
    `# Updated by scripts/organize-env-files.mjs at ${new Date().toISOString()}`,
    "# Secrets remain in-place; do not commit real secret files.",
    "",
  ];

  if (header.length) {
    lines.push("# Preserved comments / unparsed lines", ...header, "");
  }

  for (const [title, keys] of GROUPS) {
    const present = keys.filter((key) => map.has(key));
    if (!present.length) continue;
    lines.push(`# === ${title} ===`);
    for (const key of present) {
      used.add(key);
      lines.push(`${key}=${map.get(key)}`);
    }
    lines.push("");
  }

  const remaining = [...map.keys()].filter((key) => !used.has(key)).sort();
  if (remaining.length) {
    lines.push("# === Other / Needs Classification ===");
    for (const key of remaining) lines.push(`${key}=${map.get(key)}`);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

async function organize(file) {
  const fullPath = path.join(ROOT, file);
  const content = await readFile(fullPath, "utf8");
  const backupPath = `${fullPath}.backup-${STAMP}`;
  await copyFile(fullPath, backupPath);

  const { map, unknownComments } = parse(content);
  if (file === ".env.local" || file === ".env.vercel") {
    for (const [key, value] of Object.entries(PREFERRED_VALUES)) {
      if (map.has(key)) map.set(key, JSON.stringify(value));
    }
  }

  await writeFile(fullPath, render(map, unknownComments), "utf8");
  return backupPath;
}

const backups = [];
for (const file of FILES) backups.push(await organize(file));

console.log(`Organized ${FILES.length} env files.`);
for (const backup of backups) console.log(`Backup: ${backup}`);
