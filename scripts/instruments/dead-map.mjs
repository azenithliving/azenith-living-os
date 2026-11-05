#!/usr/bin/env node
/**
 * dead-map.mjs — classify what is dead, erase nothing.
 *
 * The census counts the doors nobody calls and the furniture no screen reaches. This instrument
 * gives each one a verdict from measured facts only — the route's own exported methods, the money
 * tables named in the record schema, and whether another door answers the same resource. A door the
 * facts cannot place stays `needs-verdict`; guessing a verdict is how surfaces quietly vanished.
 *
 * Writes docs/ledger/dead-map.json. Exits 1 when the census did not answer, so a missing inventory
 * can never read as an empty one.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";

import { DEAD_VERDICTS, formatDeadLine, verdictOf } from "../../lib/build/dead-map.ts";

const censusPath = "docs/ledger/census.json";
if (!existsSync(censusPath)) {
  console.error("the census did not answer — run: node scripts/ops-census.mjs");
  process.exitCode = 1;
} else {
  const census = JSON.parse(readFileSync(censusPath, "utf8"));
  const atoms = census.atoms ?? [];

  // Money tables come from the migrations that own the record, not from a list typed here.
  const migrationDir = "supabase/migrations";
  const moneyTables = new Set();
  for (const file of readdirSync(migrationDir)) {
    if (!file.endsWith(".sql")) continue;
    const sql = readFileSync(`${migrationDir}/${file}`, "utf8");
    for (const m of sql.matchAll(/create table (?:if not exists )?([a-zA-Z0-9_.]+)/gi)) {
      const name = m[1].split(".").pop();
      if (/order|payment|price|invoice|subscription|booking|checkout|wallet|refund/i.test(name)) moneyTables.add(name);
    }
  }
  const moneyList = [...moneyTables].sort();
  const moneySet = new Set(moneyList);

  const allDoors = atoms.filter((a) => String(a.id).endsWith("route.ts") && String(a.id).startsWith("app/api/"));
  const orphan = allDoors.filter((a) => a.kind === "orphan-door");

  // Every table the record actually has, and the tables a reachable surface still reads.
  const existingTables = new Set();
  for (const file of readdirSync(migrationDir)) {
    if (!file.endsWith(".sql")) continue;
    for (const m of readFileSync(`${migrationDir}/${file}`, "utf8").matchAll(/create table (?:if not exists )?([a-zA-Z0-9_.]+)/gi)) {
      existingTables.add(m[1].split(".").pop());
    }
  }
  const tablesOf = (text) =>
    [...new Set([...text.matchAll(/\.from\(\s*["'`]([a-zA-Z0-9_]+)["'`]/g)].map((m) => m[1]))];

  const liveTables = new Set();
  for (const door of allDoors) {
    if (door.kind === "orphan-door" || !existsSync(door.id)) continue;
    for (const t of tablesOf(readFileSync(door.id, "utf8"))) liveTables.add(t);
  }

  const rows = orphan.map((door) => {
    const text = existsSync(door.id) ? readFileSync(door.id, "utf8") : "";
    const tables = tablesOf(text);
    const touched = tables.filter((t) => moneySet.has(t));
    const facts = {
      id: door.id,
      writes: /export\s+(async\s+)?function\s+(POST|PUT|PATCH|DELETE)/.test(text),
      money: touched.length > 0,
      twin: tables.some((t) => liveTables.has(t)),
      retired: /qayyim/.test(door.id),
      tableMissing: tables.length > 0 && tables.every((t) => !existingTables.has(t)),
    };
    return {
      atom: door.id,
      lines: door.lines ?? null,
      verdict: verdictOf(facts),
      tables,
      facts: {
        writes: facts.writes,
        moneyTables: touched,
        twin: facts.twin,
        retired: facts.retired,
        tableMissing: facts.tableMissing,
      },
    };
  });

  const counts = {};
  for (const v of DEAD_VERDICTS) counts[v.id] = rows.filter((r) => r.verdict === v.id).length;

  const furniture = atoms.filter((a) => a.kind === "furniture" && a.usedBy === "unreachable");
  const furnitureRows = furniture.map((f) => ({ atom: f.id, lines: f.lines ?? null, verdict: "needs-verdict" }));

  const out = {
    generatedAt: new Date().toISOString(),
    censusGeneratedAt: census.generatedAt ?? null,
    moneyTables: moneyList,
    doors: rows.length,
    furniture: furnitureRows.length,
    counts,
    rows,
    furnitureRows,
  };
  writeFileSync("docs/ledger/dead-map.json", JSON.stringify(out, null, 2) + "\n", "utf8");

  console.log(
    `dead map: ${rows.length} doors · ${JSON.stringify(counts)} · ${furnitureRows.length} unreachable furniture → docs/ledger/dead-map.json`,
  );
  console.log(formatDeadLine({ doors: rows.length, furniture: furnitureRows.length, counts }));
}
