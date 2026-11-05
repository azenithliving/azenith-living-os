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
 *
 * Two limits stay visible instead of being quietly counted as clean: a query whose table is a
 * variable the scan cannot follow is reported as unread (`coverageLine`), and the window a query owns
 * runs to the next `.from(` rather than to the end of the statement, so a column in trailing
 * same-block code can still be charged to the query above it.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { findPhantoms, formatRefusalLine, fromSiteCensus, refsFromSource, splitByReachability, tallyPhantoms } from "../../lib/build/phantom-names.ts";
import { classifyBySymbol, formatReachabilityLine, isEntryFile } from "../../lib/build/reachability.ts";
import { arDigits } from "../../lib/ops/metricLabels.ts";

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
    const sources = {};
    const refs = [];
    let fromSites = 0;
    let blindSites = 0;
    for (const file of files) {
      const path = file.split("\\").join("/");
      const source = readFileSync(file, "utf8");
      sources[path] = source;
      if (!source.includes(".from(")) continue;
      const census = fromSiteCensus(source);
      fromSites += census.sites;
      blindSites += census.blind;
      refs.push(...refsFromSource(path, source));
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

    // The headline is every name the record refused in a file the census still counts as standing.
    // The static read below sorts that same list; it may never shrink it — a code graph is not proof
    // of execution, and a name it cannot place stays in the count, not in a bin nobody reads.
    const tally = tallyPhantoms(split.live);
    const reached = classifyBySymbol(split.live, sources);
    const deadTally = tallyPhantoms(split.deadCode);
    const entryFiles = Object.keys(sources).filter(isEntryFile);

    const out = {
      measuredAt: new Date().toISOString(),
      mapMeasuredAt: map.measuredAt,
      filesScanned: files.length,
      entryFiles: entryFiles.length,
      refsSeen: refs.length,
      fromSites,
      unresolvedFromSites: blindSites,
      tablesInRecord: Object.keys(map.tables).length,
      deadPathsConsidered: deadPaths.size,
      ...tally,
      line: formatRefusalLine(tally),
      coverageLine: `تغطية المسح: ${arDigits(fromSites)} موضع سؤال في الكود · ${arDigits(blindSites)} منهم جدولهم مكتوب في متغيّر ما اتحلّش — دول ما اتقارش، مش مرفوضين`,
      classification: reached.tally,
      classificationLine: formatReachabilityLine(reached.tally),
      deadCodeLine: formatRefusalLine(deadTally),
      phantoms: reached.all,
      deadCodePhantoms: split.deadCode,
    };
    writeFileSync("docs/ledger/refusal-scan.json", JSON.stringify(out, null, 2) + "\n", "utf8");

    console.log(
      `refusal scan: ${files.length} files · ${entryFiles.length} entry files · ${refs.length} column mentions read · ${fromSites} query places (${blindSites} unread) · ${tally.total} refused by the record (${tally.distinct} distinct names) · ${deadTally.total} in census-dead code → docs/ledger/refusal-scan.json`,
    );
    console.log(out.line);
    console.log(out.coverageLine);
    console.log(out.classificationLine);
    const byTable = {};
    for (const p of reached.all) (byTable[p.table] ??= []).push(`${p.column || "(جدول)"} ← ${p.symbol} · ${p.reach} · ${p.file}`);
    for (const [table, list] of Object.entries(byTable)) {
      console.log(`  ${table}:`);
      for (const entry of [...new Set(list)]) console.log(`    ${entry}`);
    }
  }
}
