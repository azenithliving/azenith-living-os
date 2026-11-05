import postgres from "postgres";
import fs from "node:fs";
import dotenv from "dotenv";

for (const f of [".env.local", ".env"]) {
  const p = process.cwd() + "/" + f;
  if (fs.existsSync(p)) dotenv.config({ path: p });
}

/**
 * Adopts the owner's waiting papers that were stored with no company.
 *
 * His word today: «موافق» after the question «أقولّي أعملها مرة واحدة». This is a data write on
 * his rows, so every affected row is copied out first (id + its company_id + status +
 * requested_at) and the file it lands in is printed; restoring is one pass over that file.
 * Nothing is deleted and no row is created.
 */
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
const COMPANY = process.env.ADMIN_COMPANY_ID?.trim();
const out = [];
const log = (s) => { out.push(s); console.log(s); };

try {
  if (!COMPANY) throw new Error("ADMIN_COMPANY_ID مش متظبط");

  const before = await sql`
    select count(*)::int total,
           count(*) filter (where company_id is null)::int orphan,
           count(*) filter (where company_id = ${COMPANY})::int owned
    from approval_requests`;
  log("قبل: " + JSON.stringify(before[0]));

  const rows = await sql`
    select id, status, company_id, requested_at, created_at
    from approval_requests where company_id is null order by created_at`;
  fs.writeFileSync(
    "scratch/checkpoint-orphan-papers.json",
    JSON.stringify({ takenAt: new Date().toISOString(), company: COMPANY, rows }, null, 2) + "\n",
  );
  log("نقطة الرجوع: " + rows.length + " سطر في scratch/checkpoint-orphan-papers.json");

  if (rows.length) {
    const ids = rows.map((r) => r.id);
    const wrote = await sql`
      update approval_requests set company_id = ${COMPANY}, updated_at = now()
      where id = any(${ids}::uuid[]) and company_id is null
        and id = any(${ids}::uuid[])`;
    log("الكتابة رجعت: " + (wrote.count ?? wrote.length) + " سطر (ردّ القاعدة نفسه)");
  }

  const after = await sql`
    select count(*)::int total,
           count(*) filter (where company_id is null)::int orphan,
           count(*) filter (where company_id = ${COMPANY})::int owned
    from approval_requests`;
  log("بعد: " + JSON.stringify(after[0]));

  const byStatus = await sql`
    select status, count(*)::int c from approval_requests group by status order by c desc`;
  log("التوزيع بالحالة: " + byStatus.map((r) => r.status + "=" + r.c).join(" · "));
} catch (e) {
  log("ERROR: " + String((e && e.stack) || e).slice(0, 300));
} finally {
  await sql.end();
  fs.writeFileSync("scratch/adopt-orphan-papers.out", out.join("\n") + "\n");
}
