/**
 * What the two remaining line shapes actually look like in his stored rows.
 *
 * The bidi census ended at 25 shapes, and the leftovers are two families, neither of them a word:
 *   معادلة — «(٢× = ٥٤٠٠٠ ج.م)»: digits, an operator, digits. In an Arabic (right-to-left) line the
 *     two number runs keep their own order but the operator between them is neutral, so the equation
 *     reads backwards. No substitution fixes that; only the direction of that run does.
 *   أقواس اقتراحات — «[تحسين المحتوى] [تحسين السرعة] [تقرير]»: the model's list written as brackets.
 *     Nothing reorders, but it is machine typography on a premium surface, and the chat already knows
 *     how to draw a list.
 *
 * Before choosing a fix, count them on the rows his screens read, through the shipping boundary, and
 * print the shapes so the rule is written against what exists — not against what a regex could match.
 *
 *   TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}' \
 *   node -r ./scratch/load-env.cjs -r ./scratch/shim-server-only.cjs -r ts-node/register/transpile-only \
 *   -r tsconfig-paths/register scratch/census-line-shapes.cts
 */
import postgres from "postgres";

import { ownerRowText } from "@/lib/ops/owner-voice";

const DIGITS = "[0-9\u0660-\u0669]";
const EQUATION = new RegExp(`${DIGITS}[^،؛\\n]{0,24}[=×][^،؛\\n]{0,24}${DIGITS}`, "g");
const BRACKET_RUN = /(?:\s*\[[^\][\n]{2,30}\]){2,}/g;

async function main() {
  const sql = postgres(process.env.DIRECT_URL as string, { ssl: "require", max: 1 });
  const rows = await sql`
    select id, content, sender_name, sender_type
      from public.agent_messages
     where sender_type <> 'user'
     order by id asc`;

  let equationLines = 0;
  let equationRuns = 0;
  let bracketLines = 0;
  let bracketRuns = 0;
  const equationShapes = new Map<string, number>();
  const bracketShapes = new Map<string, number>();
  const samples: string[] = [];

  for (const row of rows) {
    const spoken = ownerRowText(String(row.content ?? ""), row.sender_name);
    for (const rawLine of spoken.split("\n")) {
      const line = rawLine.trim();
      if (line.length < 4) continue;

      const eq = line.match(EQUATION) ?? [];
      if (eq.length) {
        equationLines += 1;
        equationRuns += eq.length;
        for (const run of eq) {
          const shape = run.replace(/[0-9\u0660-\u0669]+/g, "#").slice(0, 30);
          equationShapes.set(shape, (equationShapes.get(shape) ?? 0) + 1);
        }
        if (samples.length < 6) samples.push(`معادلة | ${line.slice(0, 110)}`);
      }

      const br = line.match(BRACKET_RUN) ?? [];
      if (br.length) {
        bracketLines += 1;
        bracketRuns += br.length;
        for (const run of br) {
          const shape = run.replace(/[^\[\]]/g, "").slice(0, 20);
          bracketShapes.set(shape, (bracketShapes.get(shape) ?? 0) + 1);
        }
        if (samples.length < 12) samples.push(`أقواس | ${line.slice(0, 110)}`);
      }
    }
  }

  console.log(`صفوف مقروءة: ${rows.length}`);
  console.log(`سطور فيها معادلة: ${equationLines} · عدد المعادلات: ${equationRuns}`);
  console.log(`سطور فيها قايمة أقواس: ${bracketLines} · عدد القايم: ${bracketRuns}`);

  console.log("\nأشكال المعادلات:");
  for (const [shape, n] of [...equationShapes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${n} × ${shape}`);
  }
  console.log("\nأشكال القايم:");
  for (const [shape, n] of [...bracketShapes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
    console.log(`  ${n} × ${shape}`);
  }
  console.log("\nعيّنة:");
  for (const s of samples) console.log(`  ${s}`);

  await sql.end();
}

main().catch((e) => {
  console.error("فشل:", String(e).slice(0, 200));
  process.exit(1);
});
