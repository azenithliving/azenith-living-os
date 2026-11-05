import postgres from "postgres";
import dotenv from "dotenv";
dotenv.config();
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
const names = ["user_preferences", "agent_memory", "agent_goals"];
const t = await sql`select table_name from information_schema.tables where table_schema='public'`;
const have = new Set(t.map((r) => r.table_name));
for (const name of names) {
  if (!have.has(name)) { console.log(`${name} · موجود=لا · أعمدة=- · صفوف=-`); continue; }
  const c = await sql`select column_name from information_schema.columns where table_schema='public' and table_name=${name} order by ordinal_position`;
  const r = await sql`select count(*)::int as c from ${sql(name)}`;
  console.log(`${name} · موجود=نعم · أعمدة=[${c.map((x) => x.column_name).join(",")}] · صفوف=${r[0].c}`);
}
await sql.end();
