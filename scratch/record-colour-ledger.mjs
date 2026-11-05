import fs from "node:fs";

/** Records the colour atom in the transfer ledger: one row per atom that moved today. */
const path = "docs/ledger/movements.json";
const ledger = JSON.parse(fs.readFileSync(path, "utf8"));
const has = (atom) => ledger.rows.some((row) => row.atom === atom);

const added = [
  {
    atom: "lib/cad/colours.ts",
    state: "moved",
    phase: "colour-1",
    when: "2026-10-03",
    proof:
      "the matrix a room can back: families are named off the bank's own distribution (measured over 5,909 stored colours — grey 36%, warm beige 23%, wood 13%, off-white 12%, dark wood and caramel 4% each), a pick is only kept when one of his room's pictures really carries it, and a claim whose label does not match its colour is refused. The near line is 40 of 255 because that is where the data splits: inside one family pictures sit 0-35 apart, a different family in the same room starts near 45",
  },
  {
    atom: "app/api/passport/[token]/colours/route.ts",
    state: "moved",
    phase: "colour-1",
    when: "2026-10-03",
    proof:
      "the colour desk behind the same secret address: it re-reads the bank rather than trusting the screen, keeps at most three, and writes one column and nothing else — a taste can never move a sealed measurement. Proved on a built server at 390px: three taps stored and read back (#7e7165, #9f8c7b, #8d6a4e), the fourth swatch arrived disabled with the reason on the same card",
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

const refreshed = {
  "app/api/passport/[token]/route.ts":
    "the sheet answers with the room and the palette together: the stored drawing, the matrix built from the pictures it really shows him, his picks, and the bank's list re-ordered by those picks — both the first read and the answer after he confirms go through the same builder, so his colours cannot vanish because one door forgot to compute them",
  "lib/cad/dossier.ts":
    "the file carries the same drawing and his own chosen colours, printed apart from the bank's palette because a colour he stopped on is his word, not the shop's. Its area line reads off the room that was drawn — which changed two earlier assertions, disclosed in the minutes",
  "components/admin/ClientPreCallDossier.tsx":
    "the owner sees his drawing read-only and his colours as named chips: «ألوانه اللي اختارها» with the real colour beside each Arabic name",
  "app/api/admin/customers/dossier/route.ts":
    "the file door reads the paper's drawing and his picks off the same row the sheet writes, so the two screens cannot disagree about who he is",
};

for (const [atom, proof] of Object.entries(refreshed)) {
  const row = ledger.rows.find((entry) => entry.atom === atom);
  if (!row) {
    console.log("no row to refresh:", atom);
    continue;
  }
  row.proof = proof;
  row.when = "2026-10-03";
  console.log("refreshed:", atom);
}

fs.writeFileSync(path, JSON.stringify(ledger, null, 2) + "\n");
