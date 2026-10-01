/**
 * The owner's key folder, brought into the store's own pool — sorted, deduped, accounted for.
 *
 * He declared on 2026-10-02 that every key in the pool is his, and pointed at the folder
 * where the rest of them live. So the job is not to distrust them; it is to do what he said
 * the dashboard must do: take them, sort them, rotate them, and verify them.
 *
 * This is the sorting step. It reads the section headers (`GROQ_KEYS:`, `GEMINI_API_KEY:`…),
 * maps them to the providers the store can actually call, drops duplicates by fingerprint,
 * and reports what is new. Values are never printed — a key that appears in a log is a key
 * that has to be rotated.
 *
 * Usage:
 *   node scripts/keys-import-folder.mjs                      # measure only
 *   node scripts/keys-import-folder.mjs --apply              # insert the new ones
 *   node scripts/keys-import-folder.mjs --apply --reopen     # and take back off the shelf
 *                                                          # what the census had paused
 */
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";

import { keyFingerprint } from "../lib/ops/key-provenance.ts";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local") });

const FOLDER = process.argv[2]?.startsWith("--")
  ? "C:/Users/noura/OneDrive/Desktop/New folder/text/api"
  : process.argv[2] || "C:/Users/noura/OneDrive/Desktop/New folder/text/api";
const APPLY = process.argv.includes("--apply");
const REOPEN = process.argv.includes("--reopen");
const FILES = ["working_keys.txt", "api kay.txt", "stopped_keys.txt", "unknown_format_keys.txt"];
const NOTE = "owner folder import 2026-10-02";
const CENSUS_REASON = "quarantined 2026-10-02: provenance unknown (key census)";

/** The header in his files → the provider name the store's picker knows. */
const SECTION_TO_PROVIDER = {
  GROQ_KEYS: "groq",
  OPENROUTER_KEYS: "openrouter",
  MISTRAL_KEYS: "mistral",
  TOGETHER_API_KEYS: "together",
  TOGETHERAI_KEYS: "together",
  AIMLAPI_KEYS: "aimlapi",
  CEREBRAS_API_KEY: "cerebras",
  COHERE_API_KEY: "cohere",
  OPENAI_KEYS: "openai",
  ANTHROPIC_KEYS: "anthropic",
  GOOGLE_AI_KEYS: "google",
  GEMINI_API_KEY: "google",
  GEMINI_KEYS: "google",
  SAMBANOVA_KEYS: "sambanova",
  PEXELS_KEYS: "pexels",
  API_NINJAS_KEYS: "api_ninjas",
  DEEPSEEK_KEYS: "deepseek",
  HUGGINGFACE_KEYS: "huggingface",
  HUGGINGFACE_API_KEY: "huggingface",
  XAI_KEYS: "xai",
  APIFREELLM_KEYS: "apifreellm",
  BYTEZ_KEYS: "bytez",
  NVIDIA_KEYS: "nvidia",
  CHUTES_KEYS: "chutes",
};

/** A key with no section is still recognisable by the shape its issuer gives it. */
const PREFIX_TO_PROVIDER = [
  [/^gsk_/, "groq"],
  [/^sk-or-/, "openrouter"],
  [/^AIza/, "google"],
  [/^sk-ant-/, "anthropic"],
  [/^sk-/, "openai"],
  [/^xai-/, "xai"],
  [/^cerebras-/, "cerebras"],
  [/^nvapi-/, "nvidia"],
  [/^sn-/, "sambanova"],
  [/^mv2-/, "aimlapi"],
];

function parseFile(path) {
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  const found = [];
  let section = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const header = /^([A-Z][A-Z0-9_]*KEYS?):$/.exec(line);
    if (header) {
      section = SECTION_TO_PROVIDER[header[1]] ?? null;
      continue;
    }
    if (/^[A-Z][A-Z0-9_ ]*$/.test(line) && line.length < 40 && !/[a-z]/.test(line)) continue;
    if (line.length < 12) continue;
    const provider = section ?? PREFIX_TO_PROVIDER.find(([re]) => re.test(line))?.[1] ?? null;
    found.push({ provider, value: line.replace(/[,;]$/, "") });
  }
  return found;
}

const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL, { ssl: "require", max: 1 });

try {
  const parsed = [];
  for (const file of FILES) {
    try {
      parsed.push(...parseFile(join(FOLDER, file)).map((entry) => ({ ...entry, file })));
    } catch {
      console.log(`skipped ${file}: not there`);
    }
  }

  const existing = await sql`select provider, key from public.api_keys`;
  const seen = new Set(existing.map((row) => `${row.provider}|${keyFingerprint(row.key)}`));

  const byProvider = new Map();
  let unattributed = 0;
  let repeats = 0;
  for (const entry of parsed) {
    const print = keyFingerprint(entry.value);
    if (!entry.provider) {
      unattributed++;
      continue;
    }
    if (seen.has(`${entry.provider}|${print}`)) {
      repeats++;
      continue;
    }
    seen.add(`${entry.provider}|${print}`);
    if (!byProvider.has(entry.provider)) byProvider.set(entry.provider, []);
    byProvider.get(entry.provider).push(entry.value);
  }

  const callable = new Set(
    (await sql`select distinct provider from public.api_keys`).map((r) => r.provider)
  );
  console.log("provider        new keys   already in the pool?   the store can call it?");
  let total = 0;
  for (const [provider, list] of [...byProvider.entries()].sort((a, b) => b[1].length - a[1].length)) {
    total += list.length;
    console.log(
      provider.padEnd(15),
      String(list.length).padStart(4),
      "            ",
      (callable.has(provider) ? "yes" : "NO — stored, never loaded").padEnd(24)
    );
  }
  console.log(`parsed=${parsed.length} new=${total} already_there=${repeats} no_provider_found=${unattributed}`);

  if (!APPLY) {
    console.log("read-only — nothing was written. pass --apply to import.");
  } else {
    for (const [provider, list] of byProvider) {
      for (const value of list) {
        await sql`
          insert into public.api_keys (provider, key, is_active, notes)
          values (${provider}, ${value}, true, ${NOTE})
          on conflict do nothing`;
      }
      console.log(`imported ${provider}: ${list.length}`);
    }
    if (REOPEN) {
      const back = await sql`
        update public.api_keys set is_active = true, notes = ${NOTE + " — reopened on the owner's word"}, updated_at = now()
         where notes = ${CENSUS_REASON}
        returning id`;
      console.log(`reopened ${back.length} rows the census had paused`);
    }
  }
} catch (error) {
  console.error("import failed:", error?.message ?? error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
