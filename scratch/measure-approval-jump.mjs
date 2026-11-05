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
  const byDay = await sql`
    select to_char(date_trunc('day', coalesce(requested_at, created_at)), 'YYYY-MM-DD') as day,
           status,
           count(*)::int as n
    from public.approval_requests
    group by 1, 2
    order by 1 desc, 2`;
  log("approval_requests by day and status:");
  for (const r of byDay) log("  " + r.day + " " + r.status + " = " + r.n);

  const pending = await sql`select count(*)::int c from public.approval_requests where status='pending'`;
  log("PENDING_NOW=" + pending[0].c);

  const owners = await sql`select (company_id is null) as no_company, count(*)::int c from public.approval_requests where status='pending' group by 1`;
  for (const o of owners) log("  pending with company missing=" + o.no_company + " -> " + o.c);

  const descs = await sql`select left(description, 70) as d, count(*)::int c, min(to_char(coalesce(requested_at, created_at),'YYYY-MM-DD')) as first_day, max(to_char(coalesce(requested_at, created_at),'YYYY-MM-DD')) as last_day
                          from public.approval_requests where status='pending' group by 1 order by c desc limit 8`;
  log("top pending descriptions:");
  for (const d of descs) log("  " + d.c + " x [" + d.d + "] " + d.first_day + " → " + d.last_day);
} catch (e) {
  log("ERROR: " + String(e && e.message ? e.message : e));
} finally {
  await sql.end();
  fs.writeFileSync("scratch/measure-approval-jump.out", out.join("\n") + "\n");
}
