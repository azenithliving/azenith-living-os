import fs from "node:fs";
import dotenv from "dotenv";
import postgres from "postgres";

for (const f of [".env.local", ".env"]) {
  const p = process.cwd() + "/" + f;
  if (fs.existsSync(p)) dotenv.config({ path: p });
}
const out = [];
const log = (s) => {
  out.push(s);
  console.log(s);
};
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });

try {
  const byKind = await sql`
    select action_type, count(*)::int n,
           to_char(min(requested_at),'YYYY-MM-DD HH24:MI') as first_at,
           to_char(max(requested_at),'YYYY-MM-DD HH24:MI') as last_at
    from public.approval_requests
    where status='pending'
    group by 1 order by 2 desc`;
  log("== pending papers by action_type ==");
  for (const r of byKind) log("  " + r.action_type + " n=" + r.n + " " + r.first_at + " → " + r.last_at);

  const byHour = await sql`
    select to_char(requested_at,'HH24') as hour, count(*)::int n
    from public.approval_requests
    where status='pending' and description like '%تقرير قرار قبل الموافقة%'
    group by 1 order by 2 desc limit 8`;
  log("== the report papers by hour of day (UTC) ==");
  for (const r of byHour) log("  hour " + r.hour + " -> " + r.n);

  const byDay = await sql`
    select to_char(requested_at,'YYYY-MM-DD') as day, count(*)::int n
    from public.approval_requests
    where status='pending' and description like '%تقرير قرار قبل الموافقة%'
    group by 1 order by 1 desc limit 10`;
  log("== the report papers by day ==");
  for (const r of byDay) log("  " + r.day + " -> " + r.n);

  const kinds = await sql`
    select metadata->'intent'->>'kind' as intent_kind, count(*)::int n
    from public.approval_requests
    where status='pending' and description like '%تقرير قرار قبل الموافقة%'
    group by 1 order by 2 desc`;
  log("== what intent those papers carry ==");
  for (const r of kinds) log("  " + (r.intent_kind ?? "none") + " -> " + r.n);

  const executors = await sql`
    select metadata->>'executor' as executor, metadata->>'proactive' as proactive, count(*)::int n
    from public.approval_requests
    where status='pending' and description like '%تقرير قرار قبل الموافقة%'
    group by 1,2 order by 3 desc`;
  log("== who wrote them ==");
  for (const r of executors) log("  executor=" + (r.executor ?? "-") + " proactive=" + (r.proactive ?? "-") + " -> " + r.n);

  const newest = await sql`
    select to_char(requested_at,'YYYY-MM-DD HH24:MI:SS') as at, action_type, left(description, 40) as d,
           to_char(expires_at,'YYYY-MM-DD HH24:MI') as expires
    from public.approval_requests order by requested_at desc limit 5`;
  log("== newest five papers of any status ==");
  for (const r of newest) log("  " + r.at + " [" + r.action_type + "] " + r.d + " · expires " + r.expires);
} catch (e) {
  log("ERROR: " + String(e && e.message ? e.message : e));
} finally {
  await sql.end();
  fs.writeFileSync("scratch/measure-approval-producer.out", out.join("\n") + "\n");
}
