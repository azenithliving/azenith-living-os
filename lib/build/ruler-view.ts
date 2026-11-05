/**
 * ruler-view.ts — the shape the owner's screen is allowed to show.
 *
 * The door and the screen read this, so the number has one owner. Two rules the project kept
 * breaking: a source that did not answer must be named (never a zero that looks like an answer), and
 * a phase whose measured atom count is zero must say it is a phase of facts, not a phase finished.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { PHASES } from "./phase-map.ts";
import { formatDeadLine, type DeadTally } from "./dead-map.ts";
import { MISSING_LABELS, formatRulerLine, readRuler, type Ruler } from "./ruler.ts";
import { arDigits } from "../ops/metricLabels.ts";

export type LedgerRow = { state: string; phase: string | null };
export type GateRecord = { tests: number | null; live: string | null; when: string | null } | null;

export type PhaseView = {
  label: string;
  atoms: string;
  moved: string;
  current: boolean;
  note: string | null;
};

export type RefusalRecord = { line: string | null; measuredAt: string | null } | null;

export type RulerView = {
  line: string;
  phases: PhaseView[];
  deadLine: string;
  refusalLine: string;
  missing: string[];
  asOf: string | null;
  gateWhen: string | null;
};

export function buildRulerView(input: {
  phase: number;
  ruler: Ruler;
  rows: LedgerRow[];
  dead: DeadTally | null;
  gate?: GateRecord;
  refusal?: RefusalRecord;
  columnsMeasuredAt?: string | null;
}): RulerView {
  const gate = input.gate ?? null;
  const missing = [...input.ruler.missing.map((key) => MISSING_LABELS[key] ?? key)];
  if (!gate) missing.push("نتيجة البوابات");
  else if (gate.tests === null) missing.push("عدد الاختبارات");

  const phases: PhaseView[] = PHASES.map((p) => {
    const seated = input.rows.filter((r) => r.phase === p.id);
    const moved = seated.filter((r) => r.state === "moved" || r.state === "erased").length;
    return {
      label: p.label,
      atoms: arDigits(seated.length),
      moved: arDigits(moved),
      current: p.index === input.phase,
      note:
        seated.length === 0
          ? "مرحلة حقيقة مش سطح: مقعد لها ٠ ذرة، وشغلها بيتقاس بالدليل مش بالعدد"
          : null,
    };
  });

  const refusal = input.refusal ?? null;
  let refusalLine = "ما اتقارش: مِقياس الرفض الصامت ما اتشغّلش";
  if (refusal?.line) {
    const stale =
      refusal.measuredAt && input.columnsMeasuredAt && Date.parse(refusal.measuredAt) < Date.parse(input.columnsMeasuredAt);
    refusalLine = stale ? `${refusal.line} — وده لقياس قديم مقابل خريطة الأعمدة` : refusal.line;
  }

  return {
    line: formatRulerLine(input.ruler, {
      phase: input.phase,
      tests: gate?.tests ?? null,
      live: gate?.live ?? null,
    }),
    phases,
    deadLine: input.dead ? formatDeadLine(input.dead) : "ما اتقارش: خريطة الميت — الأمر ما اتشغّلش",
    refusalLine,
    missing,
    asOf: input.ruler.asOf ? arDigits(input.ruler.asOf) : null,
    gateWhen: gate?.when ? arDigits(gate.when) : null,
  };
}

function readJson(path: string): Record<string, any> | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, any>;
  } catch {
    return null;
  }
}

/** The door and the screen both call this, so the ledger has one reader. */
export function loadRulerView(options: {
  ledgerDir: string;
  masterListPath?: string;
  /** Omitted on purpose by the door: the current phase is whatever the last gate run reported. */
  phase?: number;
  root?: string;
}): RulerView {
  const dir = options.ledgerDir;
  const ruler = readRuler({
    masterListPath: options.masterListPath,
    ledgerDir: dir,
    cronDoorRoot: options.root ?? process.cwd(),
  });

  const transfers = readJson(join(dir, "transfers.json"));
  const rows: LedgerRow[] = (Array.isArray(transfers?.rows) ? transfers.rows : []).map((r: Record<string, any>) => ({
    state: String(r?.state ?? "not-moved"),
    phase: r?.phase ?? null,
  }));

  const deadFile = readJson(join(dir, "dead-map.json"));
  const dead: DeadTally | null = deadFile
    ? { doors: deadFile.doors ?? null, furniture: deadFile.furniture ?? null, counts: deadFile.counts ?? null }
    : null;

  const gateFile = readJson(join(dir, "last-gate.json"));
  const gate: GateRecord = gateFile
    ? {
        tests: gateFile.tests ?? null,
        live: gateFile.live ?? null,
        when: gateFile.generatedAt ? String(gateFile.generatedAt).slice(0, 16).replace("T", " ") : null,
      }
    : null;

  const columnsFile = readJson(join(dir, "record-columns.json"));
  const scanFile = readJson(join(dir, "refusal-scan.json"));
  const refusal: RefusalRecord = scanFile
    ? { line: scanFile.line ?? null, measuredAt: scanFile.measuredAt ?? null }
    : null;

  return buildRulerView({
    phase: options.phase ?? gateFile?.phase ?? 0,
    ruler,
    rows,
    dead,
    gate,
    refusal,
    columnsMeasuredAt: columnsFile?.measuredAt ?? null,
  });
}
