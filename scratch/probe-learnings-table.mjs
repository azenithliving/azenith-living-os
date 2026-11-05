import { config as loadEnv } from "dotenv";
import postgres from "postgres";
loadEnv({ path: ".env.local" });
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
const t = await sql`select table_name from information_schema.tables where table_schema='public' and table_name in ('consultant_learnings','consultant_questions','pending_knowledge_questions')`;
console.log("tables:", JSON.stringify(t.rows ?? t));
try {
  const c = await sql`select count(*)::int as n from consultant_learnings`;
  console.log("consultant_learnings rows =", c[0].n);
} catch (e) { console.log("learnings query failed:", e.message, "code=", e.code); }
try {
  const k = await sql`select key from information_schema.columns where table_name='consultant_learnings'`;
  console.log("columns:", (k.rows ?? k).map(r => r.column_name ?? r.key).join(","));
} catch (e) { console.log("cols failed:", e.message); }
const cols = await sql`select column_name, data_type from information_schema.columns where table_schema='public' and table_name='consultant_learnings' order by ordinal_position`;
console.log("schema:", cols.map(r => `${r.column_name}:${r.data_type}`).join(" | ") || "(no columns = table missing)");
await sql.end();
