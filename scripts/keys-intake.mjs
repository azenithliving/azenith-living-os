/**
 * Taking the owner's key folder into the store's own ledger.
 *
 * Read by default: it classifies every token, fingerprints it, and reports what the
 * database already has versus what is new — without writing anything. `--apply` inserts the
 * new, provider-known keys as INACTIVE with a note, because a key that has not been
 * verified has no business carrying a customer's request yet.
 *
 * Usage:
 *   node scripts/keys-intake.mjs                     # measure the folder
 *   node scripts/keys-intake.mjs --apply             # insert the new known keys, inactive
 *   node scripts/keys-intake.mjs --folder <path>     # a different folder
 */
import dotenv from "dotenv";
import { readFileSync, readdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import postgres from "postgres";

import { classifyKey, intakeCorpus, keysFromLine } from "../lib/ops/key-intake.ts";
import { keyFingerprint } from "../lib/ops/key-provenance.ts";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local") });

const APPLY = process.argv.includes("--apply");
const folderFlag = process.argv.indexOf("--folder");
const FOLDER = folderFlag > -1 ? process.argv[folderFlag + 1] : "C:/Users/noura/OneDrive/Desktop/New folder/text/api";

if (!existsSync(FOLDER)) {
  console.error(`the folder is not there: ${FOLDER}`);
  process.exit(2);
}

const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL, { ssl: "require", max: 1 });
const NOTE = "intake 2026-10-02 from his key folder: awaiting verification";

try {
  const files = readdirSync(FOLDER).filter((f) => f.endsWith(".txt"));
  const lines = files.flatMap((f) => readFileSync(join(FOLDER, f), "utf8").split(/\r?\n/));
  const result = intakeCorpus(lines);

  console.log(`folder: ${FOLDER}`);
  console.log(`files: ${files.join(", ")}`);
  console.log(`tokens=${result.total} distinct=${result.rows.length} duplicates=${result.duplicates} not-a-key=${result.rejected} provider-unknown=${result.unclassified}`);
  console.log("by provider:");
  for (const [provider, count] of Object.entries(result.byProvider).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(provider).padEnd(12)} ${count}`);
  }

  const usable = result.rows.filter((r) => r.provider && r.provider !== "unknown" && !r.rejected);
  const wanted = new Map(usable.map((row) => [keyFingerprint(row.token), row]));

  const existing = await sql`select id, provider, key, is_active, notes from public.api_keys`;
  const existingPrints = new Set(existing.map((row) => keyFingerprint(row.key)));
  const fresh = [...wanted.entries()].filter(([print]) => !existingPrints.has(print));

  console.log(`in the database already: ${wanted.size - fresh.length} of ${wanted.size} classified keys`);
  console.log(`new to the store: ${fresh.length}`);

  if (!APPLY) {
    console.log("read-only — nothing was written. pass --apply to insert the new keys inactive, then verify them.");
  } else {
    let inserted = 0;
    for (const [, row] of fresh) {
      await sql`insert into public.api_keys (provider, key, is_active, notes) values (${row.provider}, ${row.token}, false, ${NOTE})`;
      inserted++;
    }
    console.log(`inserted ${inserted} rows as inactive, noted "${NOTE}". nothing was deleted or re-labelled.`);
    console.log("next: node scripts/keys-verify.mjs --provider <one> --limit 20");
  }
} catch (error) {
  console.error("intake failed:", error?.message ?? error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
