/**
 * One correction to the record, not a rewrite of it.
 *
 * Four readings (ids 9-12) were stored with `witnesses.offline` saying a pixel engine had
 * finished in 480 ms at 96% confidence. It never ran: the test instrument handed that
 * reading to the door in the request body and the door believed it. The door no longer
 * accepts a witness from a client (guarded in tests/cad/sketchLink.test.ts), and the four
 * rows are stamped here with what actually happened.
 *
 * Nothing is destroyed. The figure the instrument supplied is kept under `as_reported`,
 * because "this number came from a fake witness" is only meaningful next to the number.
 *
 * Usage: node scripts/mark-instrument-witness.mjs 9 10 11 12
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import postgres from "postgres";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local") });

const ids = process.argv.slice(2).map(Number).filter(Number.isInteger);
if (ids.length === 0) {
  console.error("usage: node scripts/mark-instrument-witness.mjs <sketch id> [...ids]");
  process.exit(2);
}

const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL, { ssl: "require", max: 1 });
try {
  for (const id of ids) {
    const rows = await sql`select witnesses, company_id from public.room_sketches where id = ${id}`;
    if (!rows.length) {
      console.log(`${id}: no such row`);
      continue;
    }
    const current = rows[0].witnesses ?? {};
    const offline = current.offline ?? null;
    if (!offline) {
      console.log(`${id}: no offline witness recorded, nothing to correct`);
      continue;
    }
    if (current.offline_provenance === "test-instrument") {
      console.log(`${id}: already marked`);
      continue;
    }
    const next = {
      ...current,
      offline: { ran: false, text: "", confidence: null, ms: 0, error: "شاهد مزيّف من أداة اختبار — ما قراش البيكسلات فعلاً" },
      offline_as_reported: offline,
      offline_provenance: "test-instrument",
    };
    await sql`update public.room_sketches set witnesses = ${sql.json(next)} where id = ${id}`;
    console.log(`${id}: marked, the old figure kept under offline_as_reported`);
  }
  const after = await sql`
    select id, witnesses->>'offline_provenance' as provenance, witnesses->'offline'->>'ran' as ran,
           witnesses->'offline_as_reported'->>'ms' as reported_ms
      from public.room_sketches where id = any(cast(${sql.array(ids)} as bigint[])) order by id`;
  for (const row of after) console.log(JSON.stringify(row));
} catch (error) {
  console.error("correction failed:", error?.message ?? error);
  process.exit(1);
} finally {
  await sql.end();
}
