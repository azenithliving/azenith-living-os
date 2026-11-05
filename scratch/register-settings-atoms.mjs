import { readFileSync, writeFileSync } from "node:fs";

/** Registers the two settings atoms in the hand-written half of the transfer ledger. */
const p = "docs/ledger/movements.json";
const m = JSON.parse(readFileSync(p, "utf8"));
const have = new Set(m.rows.map((r) => r.atom));

const add = [
  {
    atom: "app/admin/v2/settings/page.tsx",
    proof:
      "the settings office in the new house reads the store record on the server and hands the desk only what it renders: three facts with a live reader, the rest counted as residue, and no credential in the page",
  },
  {
    atom: "components/admin/settings/SettingsFactsDesk.tsx",
    proof:
      "measured 2026-10-13 with the census script and a reader grep over the repository: the settings table holds 17 keys, 3 are read by something that renders (theme and seo in the site shell, telegram_config in the alert door), 14 are read by nothing but the old desk generic editor — so the new desk names the three, counts the fourteen as unread residue, and offers no erase",
  },
];

let n = 0;
for (const row of add) {
  if (have.has(row.atom)) {
    console.log("already registered: " + row.atom);
    continue;
  }
  m.rows.push({ atom: row.atom, state: "moved", phase: "settings-1", when: "2026-10-13", proof: row.proof });
  n++;
}
writeFileSync(p, JSON.stringify(m, null, 2) + "\n", "utf8");
const back = JSON.parse(readFileSync(p, "utf8"));
console.log(`added=${n} · rows=${back.rows.length} · moved rows=${back.rows.filter((r) => r.state === "moved").length}`);
