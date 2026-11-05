#!/usr/bin/env node
/**
 * refusal-scan.mjs — the phase-three ruler: names in the code against answers in the record.
 *
 * It walks the shipped source, reads every table and column the code asks the record for, and
 * compares them with docs/ledger/record-columns.json. What comes back is the list of silent refusals
 * — the queries that do not throw, return nothing, and show the owner a zero.
 *
 * Reads only. Writes docs/ledger/refusal-scan.json. Exits 1 when the column map is missing or stale,
 * because a scan against an old map would be a guess dressed as a measurement.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { findPhantoms, formatRefusalLine, refsFromSource, splitByReachability, tallyPhantoms } from "../../lib/build/phantom-names.ts";

const MAP_PATH = "docs/ledger/record-columns.json";
const ROOTS = ["app", "lib", "components", "services", "hooks"];
const MAX_MAP_AGE_DAYS = 7;

if (!existsSync(MAP_PATH)) {
  console.error("ما اتقارش: خريطة الأعمدة — شغّل أول: node scripts/instruments/record-columns.mjs");
  process.exitCode = 1;
} else {
  const map = JSON.parse(readFileSync(MAP_PATH, "utf8"));
  const ageDays = (Date.now() - new Date(map.measuredAt).getTime()) / 86_400_000;
  if (!Number.isFinite(ageDays) || ageDays > MAX_MAP_AGE_DAYS) {
    console.error(`ما اتقارش: خريطة الأعمدة قديمة (${map.measuredAt}) — أعد القياس قبل المسح`);
    process.exitCode = 1;
  } else {
    const walk = (dir, acc = []) => {
      if (!existsSync(dir)) return acc;
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) walk(full, acc);
        else if (/\.(ts|tsx)$/.test(full) && !/\.test\.|\.spec\./.test(full)) acc.push(full);
      }
      return acc;
    };

    const files = ROOTS.flatMap((root) => walk(root));
    const refs = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (!source.includes(".from(")) continue;
      refs.push(...refsFromSource(file.split("\\").join("/"), source));
    }

    const phantoms = findPhantoms(refs, map.tables);

    // Which of these files can an owner surface still reach? The census answers, not a guess.
    const census = existsSync("docs/ledger/census.json") ? JSON.parse(readFileSync("docs/ledger/census.json", "utf8")) : null;
    const transfers = existsSync("docs/ledger/transfers.json") ? JSON.parse(readFileSync("docs/ledger/transfers.json", "utf8")) : null;
    const deadPaths = new Set([
      ...(census?.atoms ?? []).filter((a) => a.kind === "orphan-door" || (a.kind === "furniture" && a.usedBy === "unreachable")).map((a) => a.id),
      ...(transfers?.rows ?? []).filter((r) => r.state === "no-surface" || r.state === "erased").map((r) => r.atom),
    ]);
    const split = splitByReachability(phantoms, [...deadPaths]);
    const tally = tallyPhantoms(split.live);
    const deadTally = tallyPhantoms(split.deadCode);

    const out = {
      measuredAt: new Date().toISOString(),
      mapMeasuredAt: map.measuredAt,
      filesScanned: files.length,
      refsSeen: refs.length,
      tablesInRecord: Object.keys(map.tables).length,
      deadPathsConsidered: deadPaths.size,
      ...tally,
      line: formatRefusalLine(tally),
      deadCodeLine: formatRefusalLine(deadTally),
      phantoms: split.live,
      deadCodePhantoms: split.deadCode,
    };
    writeFileSync("docs/ledger/refusal-scan.json", JSON.stringify(out, null, 2) + "\n", "utf8");

    console.log(
      `refusal scan: ${files.length} files · ${refs.length} names asked · ${tally.total} in reachable code · ${deadTally.total} in dead code → docs/ledger/refusal-scan.json`,
    );
    console.log(out.line);
    console.log(out.deadCodeLine);
    const byTable = {};
    for (const p of split.live) (byTable[p.table] ??= []).push(p.column || "(جدول)");
    for (const [table, list] of Object.entries(byTable)) {
      console.log(`  ${table}: ${[...new Set(list)].join(", ")}`);
    }
  }
}
