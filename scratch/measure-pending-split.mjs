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
const sql = postgres(env_url(), { ssl: "require", max: 1 });
function env_url() {
  return process.env.DIRECT_URL;
}

try {
  const all = await sql`select count(*)::int c from public.approval_requests where status='pending'`;
  const assistant = await sql`select count(*)::int c from public.approval_requests where status='pending' and action_type like 'assistant_%'`;
  const byKind = await sql`select action_type, count(*)::int c from public.approval_requests where status='pending' group by 1 order by 2 desc limit 10`;
  log("PENDING_ALL=" + all[0].c);
  log("PENDING_ASSISTANT=" + assistant[0].c);
  for (const r of byKind) log("  " + r.action_type + " -> " + r.c);

  const mine = await sql`
    select id, to_char(requested_at,'YYYY-MM-DD HH24:MI:SS') as at, action_type, left(description, 60) as d
    from public.approval_requests
    where status='pending' and requested_at > now() - interval '25 minutes'
    order by requested_at desc`;
  log("RECENT_PENDING=" + mine.length);
  for (const r of mine) log("  " + r.at + " [" + r.action_type + "] " + String(r.d).replace(/\n/g, " / "));
} catch (e) {
  log("ERROR: " + String(e && e.message ? e.message : e));
} finally {
  await sql.end();
  fs.writeFileSync("scratch/measure-pending-split.out", out.join("\n") + "\n");
}
