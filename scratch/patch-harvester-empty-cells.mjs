import { readFileSync, writeFileSync } from "node:fs";

/**
 * Pointing the cover harvester at what is still empty.
 *
 * The first run planned 50 rows and wrote 30: twenty pictures were already in the bank under another
 * room, and the row's id IS the provider's photo id, so they conflicted away. Eight (room, style)
 * cells are still empty, and those are the ones the storefront keeps answering with a random search.
 *
 * This patches the instrument to (١) ask the database which cells are empty, (٢) skip any picture the
 * bank already holds, and (٣) judge with fewer workers, because a third of the scorings came back
 * "all providers exhausted" at ten in parallel.
 */
const file = "scratch/harvest-room-covers.cts";
const text = readFileSync(file, "utf8");

const EDITS = [
  {
    from: "const PULL_PER_CELL = 8;",
    to: "const PULL_PER_CELL = 14;",
  },
  {
    from: "const WORKERS = 10;",
    to: "const WORKERS = 4;",
  },
  {
    from: [
      "  const cells: Array<[string, string]> = [];",
      "  for (const room of Object.keys(ROOM_TERMS)) for (const style of STYLES) cells.push([room, style]);",
    ].join("\n"),
    to: [
      "  // Which cells the bank really holds pictures for — read, not assumed.",
      "  const held = await sql`select room_type, style, count(*)::int n from public.curated_images",
      "                         where is_active = true and room_type in ${sql(Object.keys(ROOM_TERMS))}",
      "                         group by 1,2`;",
      "  const full = new Set(held.filter((r) => r.n > 0).map((r) => `${r.room_type}/${r.style}`));",
      "  const known = new Set((await sql`select id from public.curated_images`).map((r) => Number(r.id)));",
      "  const wantedCells = Object.keys(ROOM_TERMS).length * STYLES.length;",
      "  console.log(`البنك مليان في ${full.size} من ${wantedCells} خلية · وصوره المعروفة: ${known.size}`);",
      "  const cells: Array<[string, string]> = [];",
      "  for (const room of Object.keys(ROOM_TERMS))",
      "    for (const style of STYLES) if (!full.has(`${room}/${style}`)) cells.push([room, style]);",
    ].join("\n"),
  },
  {
    from: "  const candidates: Candidate[] = [];",
    to: "  const candidates: Candidate[] = [];\n  const seenIds = new Set<number>();",
  },
  {
    from: "    const found = await pullCell(room, style);",
    to: [
      "    // A picture the bank already files under another room cannot be filed twice: its id IS the",
      "    // provider's photo id. Twenty rows were lost that way in the first run.",
      "    const found = (await pullCell(room, style)).filter((c) => !known.has(c.id) && !seenIds.has(c.id));",
      "    for (const c of found) seenIds.add(c.id);",
    ].join("\n"),
  },
];

for (const edit of EDITS) {
  const hits = text.split(edit.from).length - 1;
  if (hits !== 1) {
    console.log(`REFUSING: anchor found ${hits} times — ${edit.from.slice(0, 60)}`);
    process.exit(1);
  }
}

let out = text;
for (const edit of EDITS) out = out.replace(edit.from, edit.to);
writeFileSync(file, out, "utf8");

const after = readFileSync(file, "utf8");
console.log(
  "patched:",
  after.includes("const held = await sql"),
  after.includes("known.has(c.id)"),
  /const PULL_PER_CELL = \d+;/.exec(after)[0],
  /const WORKERS = \d+;/.exec(after)[0]
);
