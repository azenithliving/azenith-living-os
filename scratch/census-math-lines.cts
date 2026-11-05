/**
 * What the arithmetic lines actually are.
 *
 * The live census counts 40 scrambled shapes on his screens, 18 of them an operator (`=` `×` `|`)
 * sitting inside an Arabic sentence. The voice pass cannot substitute a glyph for a calculation:
 * «٢× = ٥٤٠٠٠٠٠» is not a word with a synonym, it is a line shape. Before choosing between a
 * spoken rewrite and a rendered table, read the exact stored lines the boundary still returns.
 *
 * This runs the SAME production boundary (`ownerRowText`) on the rows the screens read, groups the
 * surviving operator lines by shape, and prints them verbatim.
 *
 *   TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}' \
 *   node -r ./scratch/load-env.cjs -r ./scratch/shim-server-only.cjs -r ts-node/register/transpile-only \
 *   -r tsconfig-paths/register scratch/census-math-lines.cts
 */
import postgres from "postgres";

import { ownerRowText } from "@/lib/ops/owner-voice";

const AR = /[\u0600-\u06FF]/;
const OPERATOR = /[=×|]/;

async function main() {
  const sql = postgres(process.env.DIRECT_URL as string, { ssl: "require", max: 1 });

  const rows = await sql`
    select id, content, sender_name, sender_type
      from public.agent_messages
     where sender_type <> 'user'
     order by id desc
     limit 3000`;

  const shapes = new Map<string, string[]>();
  let lines = 0;
  let rowHits = 0;

  for (const row of rows) {
    const spoken = ownerRowText(String(row.content ?? ""), row.sender_name);
    let hits = 0;
    for (const rawLine of spoken.split("\n")) {
      const line = rawLine.replace(/\s+/g, " ").trim();
      if (line.length < 4 || !AR.test(line)) continue;
      if (!OPERATOR.test(line)) continue;
      hits += 1;
      lines += 1;
      // Group by the operator's neighbourhood, not the whole sentence, so 18 lines show as a few shapes.
      const shape = line.replace(/[\u0600-\u06FF\u0660-\u0669]+/g, "#").slice(0, 40);
      const bucket = shapes.get(shape) ?? [];
      if (bucket.length < 4) bucket.push(line.slice(0, 120));
      shapes.set(shape, bucket);
    }
    if (hits) rowHits += 1;
  }

  console.log(`صفوف فيها سطر عامل: ${rowHits} · عدد السطور: ${lines}`);
  console.log(`\n=== الأشكال ===`);
  for (const [shape, samples] of [...shapes.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\nشكل ${shape}`);
    for (const s of samples) console.log(`   ${s}`);
  }
  await sql.end();
}

main().catch((e) => {
  console.error("فشل:", e);
  process.exit(1);
});
