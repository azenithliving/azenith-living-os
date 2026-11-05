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
  // The paper the first run of the instrument opened at 17:19 UTC carries the report text inside it.
  const rows = await sql`
    select id, to_char(requested_at,'YYYY-MM-DD HH24:MI:SS') as at, action_type, description,
           metadata->>'legacyDescription' as legacy
    from public.approval_requests
    where status='pending' and requested_at >= '2026-11-03 17:15' and requested_at <= '2026-11-03 17:25'
    order by requested_at`;
  log("PAPERS_FROM_FIRST_RUN=" + rows.length);
  for (const r of rows) {
    log("  id=" + String(r.id).slice(0, 8) + " at=" + r.at + " kind=" + r.action_type);
    const text = String(r.legacy ?? r.description ?? "");
    for (const line of text.split("\n")) {
      if (line.trim() === "") continue;
      log("    | " + line.slice(0, 160));
    }
  }

  const apply = process.argv.includes("--apply");
  log("== sweeping only the papers this instrument opened ==");
  log("APPLY=" + apply);
  for (const r of rows) {
    const isMine = r.action_type === "assistant_analytics" && String(r.description ?? "").startsWith("تقرير قرار قبل الموافقة");
    if (!isMine) {
      log("  SKIPPED (not this instrument's shape): " + String(r.id).slice(0, 8));
      continue;
    }
    if (!apply) {
      log("  would delete " + String(r.id).slice(0, 8));
      continue;
    }
    await sql`delete from public.approval_requests where id = ${r.id}`;
    log("  deleted " + String(r.id).slice(0, 8));
  }
  const left = await sql`
    select count(*)::int c from public.approval_requests
    where status='pending' and requested_at >= '2026-11-03 17:15' and requested_at <= '2026-11-03 17:25'`;
  log("LEFT_FROM_THAT_WINDOW=" + left[0].c);
  const total = await sql`select count(*)::int c from public.approval_requests where status='pending'`;
  log("PENDING_NOW=" + total[0].c);
} catch (e) {
  log("ERROR: " + String(e && e.message ? e.message : e));
} finally {
  await sql.end();
  fs.writeFileSync("scratch/measure-report-paper.out", out.join("\n") + "\n");
}
