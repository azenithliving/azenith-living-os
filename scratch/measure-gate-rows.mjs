/**
 * measure-gate-rows.mjs — what the ledger actually holds about the quality gate.
 *
 * The strip prints a refusal; this counts how many refusals can explain themselves.
 */
import fs from "node:fs";
import dotenv from "dotenv";
import postgres from "postgres";

for (const f of [".env.local", ".env"]) if (fs.existsSync(f)) dotenv.config({ path: f });

const out = [];
const say = (s) => {
  out.push(s);
  console.log(s);
};

const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
try {
  const rows = await sql`
    select event_type,
           count(*)::int c,
           count(*) filter (where jsonb_array_length(coalesce(payload->'violations','[]'::jsonb)) = 0) empty_list,
           count(*) filter (where payload ? 'summary') has_summary
    from public.ops_sync_events
    where event_type in ('quality_gate_failed','quality_gate_passed')
    group by event_type`;
  for (const r of rows) {
    say(`${r.event_type} rows=${r.c} emptyViolationList=${r.empty_list} withSummary=${r.has_summary}`);
  }

  const backup = await sql`
    select count(*)::int c from public._p7_backup_qayyim_sync_events
    where event_type in ('quality_gate_failed','quality_gate_passed')`;
  say(`same gate rows in the p7 backup relation: ${backup[0].c}`);
} finally {
  fs.writeFileSync("scratch/measure-gate-rows.out", out.join("\n") + "\n");
  await sql.end({ timeout: 5 });
}
