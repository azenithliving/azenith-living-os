import { readFileSync } from "node:fs";
import { OFFICES, SHARED_OFFICE, officeOf } from "../lib/ops/migration-map.ts";

const census = JSON.parse(readFileSync("docs/ledger/census.json", "utf8"));
const tally = {};
const unassigned = [];
for (const atom of census.atoms) {
  const seat = officeOf(atom);
  const key = seat ? (seat.office === SHARED_OFFICE ? "shared" : seat.office) : "NONE";
  tally[key] = (tally[key] ?? 0) + 1;
  if (!seat) unassigned.push(`${atom.kind} ${atom.id}`);
}
console.log("atoms", census.atoms.length);
console.log("offices declared", OFFICES.length);
console.log(JSON.stringify(tally, null, 1));
console.log("unassigned", unassigned.length);
console.log(unassigned.slice(0, 25).join("\n"));
