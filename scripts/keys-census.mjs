/**
 * The key census: what the store is running on, and whether he can account for it.
 *
 * Read by default. `--apply` quarantines (deactivates, never deletes) the rows that are
 * provably surplus — a provider where at least one key matches something in his own env,
 * and rows that are not that key. A provider with no owned key is reported and left alone,
 * because switching off every key he cannot account for would switch off the capability
 * too, and a store that goes dark to look clean is the wrong kind of honest.
 *
 * Usage:
 *   node scripts/keys-census.mjs            # measure
 *   node scripts/keys-census.mjs --apply    # quarantine the provably surplus
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import postgres from "postgres";

import { keyFingerprint, ownerFingerprints, OWNER_ENV_NAMES } from "../lib/ops/key-provenance.ts";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local") });

const APPLY = process.argv.includes("--apply");
const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL, { ssl: "require", max: 1 });

const REASON = "quarantined 2026-10-02: provenance unknown (key census)";

try {
  const rows = await sql`
    select id, provider, key, is_active, total_requests, notes
      from public.api_keys`;

  const byProvider = new Map();
  for (const row of rows) {
    const provider = String(row.provider ?? "").toLowerCase();
    if (!byProvider.has(provider)) byProvider.set(provider, []);
    byProvider.get(provider).push(row);
  }

  const census = [];
  for (const [provider, list] of [...byProvider.entries()].sort()) {
    const owned = ownerFingerprints(provider);
    const seen = new Set();
    let owner = 0;
    let duplicates = 0;
    const unknownIds = [];
    for (const row of list) {
      const print = keyFingerprint(row.key);
      if (owned.has(print)) owner++;
      else unknownIds.push(row.id);
      if (seen.has(print)) duplicates++;
      seen.add(print);
    }
    // Only the names this module actually reads for this provider. The looser match once
    // printed every credential in the file against every provider, which made the report
    // look like the store owned keys it never reads.
    const envNames = (OWNER_ENV_NAMES[provider] ?? []).filter((name) => String(process.env[name] ?? "").trim());
    census.push({
      provider,
      rows: list.length,
      active: list.filter((r) => r.is_active).length,
      owner,
      unknown: unknownIds.length,
      duplicates,
      requests: list.reduce((sum, r) => sum + Number(r.total_requests ?? 0), 0),
      envNames,
      unknownIds,
    });
  }

  const pad = (text, width) => String(text).padEnd(width);
  console.log("provider      rows active owned unknown dupes requests  env names of his own");
  for (const c of census) {
    console.log(
      pad(c.provider, 13),
      pad(c.rows, 4), pad(c.active, 6), pad(c.owner, 5), pad(c.unknown, 7), pad(c.duplicates, 6), pad(c.requests, 8),
      c.envNames.join(",") || "—"
    );
  }
  const total = census.reduce((acc, c) => ({
    rows: acc.rows + c.rows, owned: acc.owned + c.owner, unknown: acc.unknown + c.unknown, duplicates: acc.duplicates + c.duplicates,
  }), { rows: 0, owned: 0, unknown: 0, duplicates: 0 });
  console.log(`TOTAL rows=${total.rows} owned_by_him=${total.owned} unknown=${total.unknown} duplicate_rows=${total.duplicates}`);

  if (!APPLY) {
    console.log("read-only run — nothing was changed. pass --apply to quarantine the provably surplus.");
    for (const c of census) {
      if (c.owner === 0 && c.active > 0) console.log(`NOT QUARANTINED ${c.provider}: no key of his, ${c.active} active rows still carrying the capability`);
    }
    process.exitCode = 0;
  } else {
    let changed = 0;
    for (const c of census) {
      if (c.owner === 0 || c.unknownIds.length === 0) {
        console.log(`skipped ${c.provider}: ${c.owner === 0 ? "no owned key to stand on" : "nothing unknown"}`);
        continue;
      }
      const result = await sql`
        update public.api_keys
           set is_active = false, notes = ${REASON}, updated_at = now()
         where id = any(cast(${sql.array(c.unknownIds)} as bigint[])) and is_active = true
         returning id`;
      changed += result.length;
      console.log(`quarantined ${c.provider}: ${result.length} rows deactivated, ${c.owner} of his left active`);
    }
    console.log(`APPLIED: ${changed} rows deactivated. nothing was deleted; is_active=true restores any of them.`);
  }
} catch (error) {
  console.error("census failed:", error?.message ?? error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
