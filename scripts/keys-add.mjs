/**
 * Adding a key the owner handed over, and asking it to prove itself before it is trusted.
 *
 * Read from a file of `provider<TAB>key` lines so a key never has to appear in a command
 * line, a log, or this repository. Each key is deduped against the pool by fingerprint,
 * inserted, then asked two questions: does its provider recognise it, and does it actually
 * write an answer. The verdict is what gets printed — never the key.
 *
 * Usage: node scripts/keys-add.mjs <path to a tab-separated provider/key file>
 */
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import postgres from "postgres";

import { keyFingerprint } from "../lib/ops/key-provenance.ts";
import { verifyKey, verifyWrites } from "../lib/ops/key-verify.ts";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local") });

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/keys-add.mjs <file with provider<TAB>key lines>");
  process.exit(2);
}

const ENGLISH_TO_PROVIDER = {
  groq: "groq",
  openrouter: "openrouter",
  sambanova: "sambanova",
  google: "google",
  gemini: "google",
  cerebras: "cerebras",
  together: "together",
  deepseek: "deepseek",
  cohere: "cohere",
  mistral: "mistral",
  anthropic: "anthropic",
  openai: "openai",
  aimlapi: "aimlapi",
};

const NOTE = "owner key 2026-10-02";
const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL, { ssl: "require", max: 1 });

try {
  // One key per line, in whatever shape he pasted it: `provider<TAB>key`, `provider=key`,
  // `provider: key`, or a bare key grouped under a `PROVIDER:` header.
  const entries = [];
  let pending = null;
  for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const header = /^([A-Za-z_]+):$/.exec(line);
    if (header && ENGLISH_TO_PROVIDER[header[1].toLowerCase()]) {
      pending = ENGLISH_TO_PROVIDER[header[1].toLowerCase()];
      continue;
    }

    const split = /^([A-Za-z_]+)\s*[\t=: ]\s*(.+)$/.exec(line);
    if (split && ENGLISH_TO_PROVIDER[split[1].toLowerCase()]) {
      const provider = ENGLISH_TO_PROVIDER[split[1].toLowerCase()];
      pending = provider;
      entries.push({ provider, key: split[2].trim().replace(/[,;]$/, "") });
      continue;
    }

    if (line.length >= 12) entries.push({ provider: pending, key: line.replace(/[,;]$/, "") });
  }

  console.log(`read ${entries.length} key(s) from the file`);
  for (const entry of entries) {
    if (!entry.provider) {
      console.log("(skipped a key with no provider named — say which company it belongs to)");
      continue;
    }
    const print = keyFingerprint(entry.key);
    const existing = await sql`select id from public.api_keys where provider = ${entry.provider} and key = ${entry.key}`;
    const id = existing.length
      ? existing[0].id
      : (await sql`insert into public.api_keys (provider, key, is_active, notes) values (${entry.provider}, ${entry.key}, true, ${NOTE}) returning id`)[0].id;

    const hello = await verifyKey(entry.provider, entry.key);
    const write = hello.state === "alive" ? await verifyWrites(entry.provider, entry.key) : { state: hello.state, status: hello.status, ms: 0, note: hello.note };
    const verdict = write.state === "writes" ? "writes" : write.state === "quota" ? "quota" : write.state === "unfunded" ? "unfunded" : "refused";

    await sql`
      update public.api_keys
         set is_active = ${verdict === "writes" || verdict === "quota"}, check_state = ${verdict},
             write_model = ${write.model ?? null},
             last_checked_at = now(), notes = ${NOTE}, last_error = ${verdict === "writes" ? null : String(write.note ?? write.state).slice(0, 120)},
             error_count = ${verdict === "writes" ? 0 : 1}
       where id = ${id}`;

    console.log(
      `${entry.provider.padEnd(11)} row #${id} ${existing.length ? "already in the pool" : "added"} · fingerprint ${print.slice(0, 6)}… · hello ${hello.status ?? "-"} · ${verdict}` +
        (verdict === "writes" ? "" : ` — ${String(write.note ?? write.state).replace(/[A-Za-z0-9_\-]{12,}/g, "‹token›").slice(0, 90)}`)
    );
  }

  const byState = await sql`select provider, check_state, count(*) n from public.api_keys where notes = ${NOTE} group by provider, check_state order by provider`;
  for (const row of byState) console.log(`  ${row.provider} → ${row.check_state} × ${row.n}`);
} catch (error) {
  console.error("adding failed:", String(error?.message ?? error).replace(/[A-Za-z0-9_\-]{20,}/g, "‹token›"));
  process.exitCode = 1;
} finally {
  await sql.end();
}
