/**
 * retire-hand-phases.mjs — the ledger's phase gets one owner.
 *
 * The census now computes each atom's phase from the office that seats it. The hand file still
 * carried 35 `phase` fields in fourteen spellings; left in place they are a second owner of the
 * same fact, which is the defect class this project keeps dying of. Only the field goes — every
 * row, state, date and proof line is kept exactly as it was.
 */
import { readFileSync, writeFileSync } from "node:fs";

const path = "docs/ledger/movements.json";
const before = readFileSync(path, "utf8");
const movements = JSON.parse(before);
const rows = movements.rows ?? [];
const withPhase = rows.filter((r) => r.phase !== undefined);
const statesBefore = JSON.stringify(rows.map((r) => [r.atom, r.state, r.when ?? null, r.proof ?? null]));

for (const row of withPhase) delete row.phase;

const statesAfter = JSON.stringify(movements.rows.map((r) => [r.atom, r.state, r.when ?? null, r.proof ?? null]));
if (statesBefore !== statesAfter) throw new Error("a state, date or proof line changed — refusing to write");

writeFileSync(path, JSON.stringify(movements, null, 2) + "\n", "utf8");
const check = JSON.parse(readFileSync(path, "utf8"));
console.log(
  `removed hand phases: ${withPhase.length} of ${rows.length} rows · rows kept: ${check.rows.length} · ` +
    `phases left: ${check.rows.filter((r) => r.phase !== undefined).length}`,
);
