/**
 * Speaks the stored history with the production boundary, not a re-implementation of it.
 *
 * The owner's word on 2026-10-11: do it, and no copy of the old text is required. So this imports
 * `ownerVoice` from the shipping module — the same code path his screens already run — and applies it
 * to every employee and system row in `agent_messages`. If it used a local copy of the rules, the
 * migration and the screen could disagree, and that is the class of bug this project has been paying
 * for all week.
 *
 * Two brakes it keeps on its own:
 * - A row whose spoken text would come out empty is SKIPPED and reported. Dropping a machine id from a
 *   sentence is translation; erasing a whole row is not.
 * - Nothing is written unless `--apply` is passed. The default run only counts and shows samples.
 *
 *   node -r ... scratch/speak-stored-rows.cts            # dry run
 *   node -r ... scratch/speak-stored-rows.cts --apply    # write
 */
import postgres from "postgres";

import { ownerRowText } from "@/lib/ops/owner-voice";

const APPLY = process.argv.includes("--apply");
const sql = postgres(process.env.DIRECT_URL as string, { ssl: "require", max: 1 });

const ENGLISH_PHRASE = /[A-Za-z]{3,}[ .,][A-Za-z]{3,}[ .,][A-Za-z]{3,}/;

async function main() {
  const rows = await sql`
    select id, content, sender_name, sender_type, created_at::date as day
      from public.agent_messages
     where sender_type <> 'user'
     order by id asc`;

  const before = {
    read: rows.length,
    withPhrase: rows.filter((r) => ENGLISH_PHRASE.test(String(r.content ?? ""))).length,
  };

  const changes: Array<{ id: string; from: string; to: string }> = [];
  let unchanged = 0;
  let skippedEmpty = 0;

  for (const row of rows) {
    const text = String(row.content ?? "");
    const spoken = ownerRowText(text, row.sender_name);
    if (spoken === text) {
      unchanged += 1;
      continue;
    }
    if (!spoken.trim()) {
      skippedEmpty += 1;
      console.log(`  متخطّي (النص كله كان آلة): #${row.id} ${row.sender_name} — «${text.slice(0, 60)}»`);
      continue;
    }
    changes.push({ id: String(row.id), from: text, to: spoken });
  }

  console.log(`\nقرايت: ${before.read} صف (غير صفوف المالك) · فيه جُملة إنجليزي: ${before.withPhrase}`);
  console.log(`ما بيتغيّرش: ${unchanged} · هيتغيّر: ${changes.length} · متخطّي فاضي: ${skippedEmpty}`);

  for (const c of changes.slice(0, 6)) {
    console.log(`\n  #${c.id} قبل:\n    ${c.from.replace(/\n/g, " ⏎ ").slice(0, 150)}`);
    console.log(`  #${c.id} بعد:\n    ${c.to.replace(/\n/g, " ⏎ ").slice(0, 150)}`);
  }

  if (!APPLY) {
    console.log("\nده تشغيل بلا كتابة — ما اتغيّرش حاجة. امرّ بـ --apply للكتابة.");
    return;
  }

  let written = 0;
  for (const c of changes) {
    await sql`update public.agent_messages set content = ${c.to} where id = ${c.id}`;
    written += 1;
  }

  // Read back from the database itself, never from the loop counter.
  const after = await sql`
    select count(*)::int as n from public.agent_messages
     where sender_type <> 'user' and regexp_like(content, ${ENGLISH_PHRASE.source})`;
  const ids = changes.map((c) => c.id);
  const spot = ids.length
    ? await sql`select id, left(content, 120) as content from public.agent_messages where id in ${sql(ids)}`
    : [];
  const stillLatin = ids.length
    ? await sql`select count(*)::int as n from public.agent_messages where id in ${sql(ids)} and content ~ '[A-Za-z]'`
    : [{ n: 0 }];

  console.log(`\nكتبت: ${written} · رجعت بالقراية من القاعدة:`);
  console.log(`  صفوف فيها جُملة إنجليزي: ${before.withPhrase} → ${after[0].n}`);
  console.log(`  صفوف من اللي اتغيّروا لسه فيها أي حرف لاتيني: ${stillLatin[0].n}`);
  for (const s of spot) console.log(`  عيّنة #${s.id}: «${String(s.content).replace(/\n/g, " ⏎ ").slice(0, 110)}»`);
}

main()
  .catch((e) => {
    console.error("failed:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
