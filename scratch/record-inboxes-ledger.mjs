import fs from "node:fs";

/** Records the cockpit's batched inbox read in the transfer ledger. */
const path = "docs/ledger/movements.json";
const ledger = JSON.parse(fs.readFileSync(path, "utf8"));
const has = (atom) => ledger.rows.some((row) => row.atom === atom);

const added = [
  {
    atom: "lib/ops/inboxes.ts",
    state: "moved",
    phase: "cockpit-1",
    when: "2026-10-05",
    proof:
      "one read answers all nine badges: the same conversation rule the messages door uses (participant or title, newest wins), the same unread definition, and a count that comes from the record rather than the page when the page fills up. A retired key folds to its live one, and an employee with no conversation answers zero — never an error the card has to wear",
  },
  {
    atom: "app/api/admin/agents/inboxes/route.ts",
    state: "moved",
    phase: "cockpit-1",
    when: "2026-10-05",
    proof:
      "measured on a built server at 390px: the cockpit now opens 1 door instead of 9 per-employee reads (0 message reads, 1 inbox read), all 9 cards carry their teaser, and a missing table answers zeros rather than a failure. The whitelist is the canvas's own staff list, because the sales manager is deliberately not a swarm key — an earlier draft of this door left his card waiting forever",
  },
];

for (const row of added) {
  if (has(row.atom)) {
    console.log("already recorded:", row.atom);
    continue;
  }
  ledger.rows.push(row);
  console.log("added:", row.atom);
}

fs.writeFileSync(path, JSON.stringify(ledger, null, 2) + "\n");
