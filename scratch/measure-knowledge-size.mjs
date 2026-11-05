import { config as loadEnv } from "dotenv";
import postgres from "postgres";
loadEnv({ path: ".env.local" });
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
for (const t of ["consultant_learnings", "consultant_pending_questions"]) {
  const r = await sql`select count(*)::int n, coalesce(sum(length(instruction::text))::bigint,0) b from ${sql(t)}`.catch(async () => {
    return await sql`select count(*)::int n, 0::bigint b from ${sql(t)}`;
  });
  console.log(t, "| سطور =", r[0].n, "| بايت النص =", String(r[0].b));
}
const pend = await sql`select status, count(*)::int c from consultant_pending_questions group by status order by 2 desc`;
console.log("حالات الأسئلة المعلّقة:", pend.map(x => `${x.status}=${x.c}`).join(" · "));
const all = await sql`select pg_total_relation_size('consultant_learnings')::bigint a, pg_total_relation_size('consultant_pending_questions')::bigint b`;
console.log("حجم الجدولين على القرص:", String(all[0].a), String(all[0].b));
await sql.end();
