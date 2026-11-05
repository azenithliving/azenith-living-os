/**
 * ruler.ts — the three numbers that make a claim believable.
 *
 * The owner's question «وصلت فين؟» was answered differently by every agent because each one read a
 * different plan. This module reads the three measured sources instead: the capability master list
 * (items by status), the transfer ledger (atoms by state) and the census (doors, pages, crons).
 *
 * A source that did not answer is named in `missing` and its block is `null` — never a zero. A zero
 * where nothing was measured is the defect this project keeps dying of.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { arDigits } from "../ops/metricLabels.ts";

export interface RulerSources {
  /** The capability master list outside the repository. */
  masterListPath?: string;
  /** Where transfers.json and census.json live. */
  ledgerDir?: string;
  /** Root used to count cron doors on disk. */
  cronDoorRoot?: string;
}

export interface ItemTally {
  total: number;
  proven: number;
  partial: number;
  builtNoProof: number;
  notBuilt: number;
  unknown: number;
}

export interface AtomTally {
  total: number;
  moved: number;
  moving: number;
  notMoved: number;
  noSurface: number;
  erased: number;
  withProof: number;
}

export interface Ruler {
  items: ItemTally | null;
  atoms: AtomTally | null;
  doors: { all: number | null; admin: number | null; orphan: number | null } | null;
  pages: { old: number | null; oldLines: number | null; new: number | null; newLines: number | null } | null;
  crons: { doors: number | null; scheduled: number | null } | null;
  /** The day the ledger was last measured — a stale number must not read as today's. */
  asOf: string | null;
  missing: string[];
}

const DEFAULT_MASTER_LIST =
  process.env.AZENITH_MASTER_LIST ?? "D:/alaa2/الشركة الجديدة/القائمة الجامعة - مسار الوصول للشكل النهائي.md";

const ITEM_LINE = /^[٠-٩0-9]+\.\s+\*\*(.+?)\*\*\s*—\s*\*([^*]+)\*/;

function classify(status: string): keyof ItemTally | "unknown" {
  const s = status.trim();
  if (s === "مُثبت بدليل") return "proven";
  if (s.includes("بلا دليل")) return "builtNoProof";
  if (s.includes("مش مبني")) return "notBuilt";
  if (s.includes("مُثبت")) return "partial";
  return "unknown";
}

function readItems(path: string): ItemTally | null {
  if (!existsSync(path)) return null;
  const tally: ItemTally = { total: 0, proven: 0, partial: 0, builtNoProof: 0, notBuilt: 0, unknown: 0 };
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = ITEM_LINE.exec(line.trim());
    if (!m) continue;
    tally.total += 1;
    tally[classify(m[2])] += 1;
  }
  return tally.total > 0 ? tally : null;
}

function readJson(path: string): Record<string, any> | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, any>;
  } catch {
    return null;
  }
}

function readAtoms(ledgerDir: string): { atoms: AtomTally | null; censusAgrees: boolean | null } {
  const transfers = readJson(join(ledgerDir, "transfers.json"));
  if (!transfers) return { atoms: null, censusAgrees: null };

  const counts = (transfers.counts ?? {}) as Record<string, number>;
  const rows = Array.isArray(transfers.rows) ? transfers.rows : [];
  const moved = Number(counts.moved ?? 0);
  const moving = Number(counts.moving ?? 0);
  const notMoved = Number(counts["not-moved"] ?? 0);
  const noSurface = Number(counts["no-surface"] ?? 0);
  const erased = Number(counts.erased ?? 0);

  const atoms: AtomTally = {
    total: moved + moving + notMoved + noSurface + erased,
    moved,
    moving,
    notMoved,
    noSurface,
    erased,
    withProof: rows.filter((row: Record<string, any>) => Boolean(row?.proof)).length,
  };

  const census = readJson(join(ledgerDir, "census.json"));
  const censusAtoms = census?.counts?.atoms;
  const censusAgrees = censusAtoms === undefined ? null : Number(censusAtoms) === atoms.total;

  return { atoms, censusAgrees };
}

function countCronDoors(root: string): number | null {
  const dir = join(root, "app", "api", "cron");
  if (!existsSync(dir)) return null;
  return readdirSync(dir, { withFileTypes: true }).filter(
    (entry) => entry.isDirectory() && existsSync(join(dir, entry.name, "route.ts")),
  ).length;
}

export function readRuler(sources: RulerSources = {}): Ruler {
  const masterListPath = sources.masterListPath ?? DEFAULT_MASTER_LIST;
  const ledgerDir = sources.ledgerDir ?? "docs/ledger";
  const cronDoorRoot = sources.cronDoorRoot ?? process.cwd();

  const missing: string[] = [];

  const items = readItems(masterListPath);
  if (!items) missing.push("masterList");

  const { atoms, censusAgrees } = readAtoms(ledgerDir);
  if (!atoms) missing.push("transfers");
  if (censusAgrees === false) missing.push("censusAtoms");

  const census = readJson(join(ledgerDir, "census.json"));
  if (!census) missing.push("census");
  const counts = (census?.counts ?? {}) as Record<string, number>;

  const transfersStamp = readJson(join(ledgerDir, "transfers.json"))?.generatedAt;
  const asOf = String(transfersStamp ?? census?.generatedAt ?? "").slice(0, 10) || null;

  const has = (key: string) => counts[key] !== undefined;
  const doors = census
    ? { all: has("allDoors") ? counts.allDoors : null, admin: has("adminDoors") ? counts.adminDoors : null, orphan: has("orphanDoors") ? counts.orphanDoors : null }
    : null;
  const pages = census
    ? { old: has("oldPages") ? counts.oldPages : null, oldLines: has("oldPageLines") ? counts.oldPageLines : null, new: has("newPages") ? counts.newPages : null, newLines: has("newPageLines") ? counts.newPageLines : null }
    : null;

  const cronDoors = countCronDoors(cronDoorRoot);
  const crons =
    census || cronDoors !== null
      ? { doors: cronDoors, scheduled: has("crons") ? counts.crons : null }
      : null;

  return { items, atoms, doors, pages, crons, asOf, missing };
}

export const MISSING_LABELS: Record<string, string> = {
  masterList: "القائمة الجامعة",
  transfers: "سجل النقل",
  census: "الجرد",
  censusAtoms: "عدّ الجرد للذرات",
};

export function formatRulerLine(
  ruler: Ruler,
  options: {
    phase: number;
    totalPhases?: number;
    tests?: number | null;
    live?: string | null;
    /** Injectable so a test can prove the staleness rule without waiting for tomorrow. */
    today?: string;
  },
): string {
  const totalPhases = options.totalPhases ?? 12;
  const parts: string[] = [`المرحلة ${arDigits(options.phase)} من ${arDigits(totalPhases)}`];
  const unmeasured: string[] = [...ruler.missing];

  if (ruler.items) parts.push(`البند ${arDigits(ruler.items.proven)} من ${arDigits(ruler.items.total)} مُثبت بدليل`);
  if (ruler.atoms) parts.push(`الذرة ${arDigits(ruler.atoms.moved)} من ${arDigits(ruler.atoms.total)} اتنقلت`);

  const today = options.today ?? new Date().toISOString().slice(0, 10);
  if (ruler.asOf && ruler.asOf !== today) parts.push(`الجرد من ${arDigits(ruler.asOf)}`);

  if (options.tests === null || options.tests === undefined) unmeasured.push("الاختبارات");
  else parts.push(`الاختبارات ${arDigits(options.tests)}`);

  if (!options.live) unmeasured.push("الدليل الحيّ");
  else parts.push(`الدليل الحيّ ${options.live}`);

  let line = parts.join(" · ");
  if (unmeasured.length) {
    line += ` · ما اتقارش: ${unmeasured.map((key) => MISSING_LABELS[key] ?? key).join("، ")}`;
  }
  return line;
}
