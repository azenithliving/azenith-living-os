/**
 * phase-map.ts — which of the twelve phases owns an atom.
 *
 * The office map (`lib/ops/migration-map`) already seats all 532 atoms, so the phase is derived from
 * the office and has exactly one owner. Hand-typing a phase per row is what produced fourteen
 * spellings in the ledger («P6», «cockpit-transfer-1», «colour-1») and let two agents answer «فاضل
 * قد إيه» with two different numbers.
 *
 * An office the table never heard of answers null. A default phase would silently move atoms into
 * work nobody chose.
 */
import { SHARED_OFFICE, officeOf, type CensusAtom } from "../ops/migration-map.ts";
import { arDigits } from "../ops/metricLabels.ts";

export type Phase = { id: string; index: number; label: string; arc: number };

export const PHASES: Phase[] = [
  { id: "M0", index: 0, label: "المِسطرة والآلة", arc: 1 },
  { id: "M1", index: 1, label: "الدفتر الحيّ", arc: 1 },
  { id: "M2", index: 2, label: "الضهر: نسخة واسترجاع", arc: 1 },
  { id: "M3", index: 3, label: "عهد المخزن", arc: 2 },
  { id: "M4", index: 4, label: "الأسماء والحقائق", arc: 2 },
  { id: "M5", index: 5, label: "البوابات والرفض العربي", arc: 2 },
  { id: "M6", index: 6, label: "ترتيب الدار", arc: 2 },
  { id: "M7", index: 7, label: "رحلة العميل من أولها لآخرها", arc: 3 },
  { id: "M8", index: 8, label: "المعرض والصورة الذهنية", arc: 3 },
  { id: "M9", index: 9, label: "العقل التحليلي واستخبار السوق", arc: 3 },
  { id: "M10", index: 10, label: "السرب كامل الدائرة", arc: 3 },
  { id: "M11", index: 11, label: "تطهير القديم", arc: 4 },
];

/**
 * Office → the phase that finishes its remaining work. The reason is the phase's own question:
 * the customer's road is M7, the swarm's completeness is M10, shared machinery is seated by the
 * layering phase, and the experimental old-house screens are only ever decided when the old house
 * is cleaned — which needs the owner's word.
 */
export const OFFICE_PHASES: Record<string, string> = {
  "decision-desk": "M1", // the ruler and the living ledger are read from the owner's own desk
  "records-office": "M1", // follow-up and records are the ledger's own surfaces
  "system-room": "M5", // settings, health and keys are privileges and their Arabic refusals
  "key-desk": "M5", // the key desk hands out what the doors check
  "image-bank": "M8", // the bank is the gallery's own store
  "sales-office": "M7", // the customer's road, question to order
  "elite-room": "M7", // the elite flow is a customer flow
  "shelf-desk": "M7", // the ready shelf is a stop on the customer's road
  "paper-desk": "M7", // the customer's drawn paper enters through his journey
  "swarm-house": "M10", // the employees close their circle together
  "workshop": "M11", // test-drive surfaces are decided when the old house is cleaned
  [SHARED_OFFICE]: "M6", // machinery several offices stand on is ordered by the layering phase
};

export function phaseOfOffice(office: string): string | null {
  return OFFICE_PHASES[office] ?? null;
}

export function phaseOfAtom(atom: CensusAtom): string | null {
  const seat = officeOf(atom);
  return seat ? phaseOfOffice(seat.office) : null;
}

export function phaseById(id: string): Phase | null {
  return PHASES.find((p) => p.id === id) ?? null;
}

export type PhaseTally = {
  total: number;
  seated: number;
  /** Atoms no office seats — named, never folded into a phase and never dropped. */
  unseated: string[];
  counts: Record<string, number>;
};

export function phaseTally(atoms: CensusAtom[]): PhaseTally {
  const counts: Record<string, number> = {};
  const unseated: string[] = [];
  for (const atom of atoms) {
    const phase = phaseOfAtom(atom);
    if (!phase) {
      unseated.push(atom.id);
      continue;
    }
    counts[phase] = (counts[phase] ?? 0) + 1;
  }
  return { total: atoms.length, seated: atoms.length - unseated.length, unseated, counts };
}

export function formatPhaseLine(options: { phase: string; tally: PhaseTally }): string {
  const phase = phaseById(options.phase);
  const head = phase
    ? `المرحلة ${arDigits(phase.index)} — ${phase.label}`
    : `المرحلة ${options.phase} ما اتقارش: مش في القائمة`;
  const body = `اللي له مكتب ${arDigits(options.tally.seated)} من ${arDigits(options.tally.total)} ذرة`;
  if (options.tally.unseated.length === 0) return `${head} · ${body} · كل ذرة لها مكتب`;
  return `${head} · ${body} · ما اتقارش: ${arDigits(options.tally.unseated.length)} ذرة مالهاش مكتب`;
}
