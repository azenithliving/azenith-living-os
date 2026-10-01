/**
 * Verifying the store's keys against the companies that issued them.
 *
 * Read by default; `--apply` writes only the verdict (active flag, note, error counters),
 * never a key, and never deletes a row. The batch is small on purpose — 20 at a time — so a
 * verification pass cannot itself become the thing that spends a provider's ceiling.
 *
 * Usage:
 *   node scripts/keys-verify.mjs --provider google --limit 5
 *   node scripts/keys-verify.mjs --new-only --limit 20 --apply
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import postgres from "postgres";

import { verifyKey } from "../lib/ops/key-verify.ts";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local") });

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : null;
};
const flag = (name) => process.argv.includes(`--${name}`);

const PROVIDER = arg("provider");
const LIMIT = Number(arg("limit") ?? 20);
const NEW_ONLY = flag("new-only");
const APPLY = flag("apply");
const CONCURRENCY = Number(arg("workers") ?? 3);

const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL, { ssl: "require", max: 1 });
const TODAY = "2026-10-02";

try {
  // Default: whatever has never been asked. Re-verifying a live key on every pass would
  // spend the ceiling the pass exists to measure.
  const where = NEW_ONLY ? sql`notes like ${"intake 2026-10-02%"}` : sql`check_state is null`;
  const rows = await sql`
    select id, provider, key, is_active from public.api_keys
     where ${where} ${PROVIDER ? sql`and provider = ${PROVIDER}` : sql``}
     order by provider, id limit ${LIMIT}`;

  console.log(`verifying ${rows.length} rows${NEW_ONLY ? " (intake only)" : ""}${PROVIDER ? ` provider=${PROVIDER}` : ""}`);

  const counts = {};
  let cursor = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, rows.length) }, async () => {
    while (cursor < rows.length) {
      const row = rows[cursor++];
      const outcome = await verifyKey(row.provider, row.key);
      counts[outcome.state] = (counts[outcome.state] ?? 0) + 1;
      // The id and the verdict are printed; the key never is.
      console.log(`  #${row.id} ${String(row.provider).padEnd(11)} ${outcome.state.padEnd(11)} http=${outcome.status ?? "-"} ${outcome.ms}ms${outcome.note ? ` ${outcome.note.slice(0, 70)}` : ""}`);
      if (APPLY) {
        const stamp = new Date().toISOString();
        if (outcome.state === "alive") {
          await sql`update public.api_keys
             set is_active = true, check_state = 'alive', last_checked_at = ${stamp},
                 notes = ${`verified ${TODAY}: alive`}, last_error = null, error_count = 0, cooldown_until = null
           where id = ${row.id}`;
        } else if (outcome.state === "quota") {
          await sql`update public.api_keys
             set is_active = true, check_state = 'quota', last_checked_at = ${stamp},
                 notes = ${`verified ${TODAY}: valid, quota spent now`}, last_error = ${"quota"},
                 cooldown_until = now() + interval '1 hour'
           where id = ${row.id}`;
        } else if (outcome.state === "dead") {
          await sql`update public.api_keys
             set is_active = false, check_state = 'refused', last_checked_at = ${stamp},
                 notes = ${`verified ${TODAY}: refused by the provider`}, last_error = ${outcome.note ?? "refused"},
                 error_count = error_count + 1
           where id = ${row.id}`;
        }
        // unreachable / unwritten: the row is left exactly as it was — no verdict, no change.
      }
    }
  });
  await Promise.all(workers);

  console.log(`states: ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(" ") || "none"}`);
  console.log(APPLY ? "verdicts written. nothing was deleted." : "read-only — pass --apply to write the verdicts.");
} catch (error) {
  console.error("verify failed:", error?.message ?? error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
