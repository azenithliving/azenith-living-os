import { readFileSync, writeFileSync } from "node:fs";

/** Registers the numbers atoms in the hand-written half of the transfer ledger. */
const p = "docs/ledger/movements.json";
const m = JSON.parse(readFileSync(p, "utf8"));
const have = new Set(m.rows.map((r) => r.atom));

const add = [
  {
    atom: "lib/store-numbers.ts",
    proof:
      "the one owner of the store's phone numbers: it reads the settings record, normalizes an Egyptian local number to the international form a WhatsApp link needs, and answers null rather than a guess. Measured 2026-10-13 before it existed: four producers of one fact, five customer pages with zero WhatsApp links, and 18 catalogue buttons opening a number that was not the store's",
  },
  {
    atom: "app/api/admin/numbers/route.ts",
    proof:
      "the only writer of the list: it takes the whole list at once, drops anything that is not dialable, refuses an empty list, keeps exactly one primary, and answers with what the record kept (wrote / stored) rather than with what it was handed",
  },
  {
    atom: "components/admin/settings/StoreNumbersCard.tsx",
    proof:
      "his desk for it: change a number, add one, mark which one the buttons open, remove with a second press, and the last number cannot be removed — deleting a row is his word, and there is no erase here",
  },
];

let n = 0;
for (const row of add) {
  if (have.has(row.atom)) {
    console.log("already registered: " + row.atom);
    continue;
  }
  m.rows.push({ atom: row.atom, state: "moved", phase: "numbers-1", when: "2026-10-13", proof: row.proof });
  n++;
}
writeFileSync(p, JSON.stringify(m, null, 2) + "\n", "utf8");
const back = JSON.parse(readFileSync(p, "utf8"));
console.log(`added=${n} · rows=${back.rows.length} · moved=${back.rows.filter((r) => r.state === "moved").length}`);
