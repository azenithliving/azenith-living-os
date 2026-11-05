/**
 * Three stored refusal lines still carry the provider's English sentence.
 *
 * The classifier that names them (`readerFailureWords`) shipped this morning, but these rows were
 * written before it, and the paper desk prints the column straight out. This re-classifies the
 * parenthetical with the production function — no invented wording, and a row whose clause the
 * classifier already understands is left exactly as it is.
 *
 *   node -r ... scratch/speak-stored-failures.cts            # dry run
 *   node -r ... scratch/speak-stored-failures.cts --apply    # write
 */
import postgres from "postgres";

import { readerFailureWords } from "@/lib/cad/paper-sketch-parser";

const APPLY = process.argv.includes("--apply");
const sql = postgres(process.env.DIRECT_URL as string, { ssl: "require", max: 1 });

// One level of nesting allowed: the first version of this pass wrote «(class (400))», and a clause
// that stops at the first closing bracket cannot see it.
const CLAUSE = /مرفوض دلوقتي \(((?:[^()]|\([^)]*\))*)\)/;

async function main() {
  const rows = await sql`select id, failure from public.room_sketches where failure is not null order by id asc`;
  const changes: Array<{ id: string; from: string; to: string }> = [];

  for (const row of rows) {
    const text = String(row.failure ?? "");
    const m = text.match(CLAUSE);
    if (!m) continue;
    const inner = m[1].trim();
    let next = text;
    if (/[A-Za-z]{3,}/.test(inner)) {
      // Still the provider's own sentence: name the class the production classifier names it.
      next = text.replace(CLAUSE, `مرفوض دلوقتي (${readerFailureWords(inner)})`);
    } else if (/\(([^)]*)\)/.test(inner)) {
      // Written by the first version of this pass, which put the status code in brackets of its own
      // inside the desk's brackets. Flatten it to a dash.
      next = text.replace(CLAUSE, `مرفوض دلوقتي (${inner.replace(/\s*\(([^)]*)\)\s*$/, " — $1")})`);
    }
    if (next !== text) changes.push({ id: String(row.id), from: text, to: next });
  }

  console.log(`قرايت ${rows.length} سطر رفض · اللي هيتغيّر: ${changes.length}`);
  for (const c of changes) {
    console.log(`  #${c.id} قبل: ${c.from.slice(0, 120)}`);
    console.log(`  #${c.id} بعد: ${c.to.slice(0, 120)}`);
  }

  if (!APPLY) {
    console.log("بلا كتابة — امرّ بـ --apply.");
    return;
  }

  for (const c of changes) await sql`update public.room_sketches set failure = ${c.to} where id = ${c.id}`;
  const left = await sql`select count(*)::int n from public.room_sketches where failure ~ '[A-Za-z]{3,}'`;
  console.log(`كتبت ${changes.length} · بالقراية من القاعدة، سطور رفض فيها لاتيني بقت: ${left[0].n}`);
}

main()
  .catch((e) => {
    console.error("failed:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
