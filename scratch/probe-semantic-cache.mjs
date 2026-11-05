import { config as loadEnv } from "dotenv";
import postgres from "postgres";
loadEnv({ path: ".env.local" });
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
const cols = await sql`select column_name, data_type from information_schema.columns where table_schema='public' and table_name='semantic_cache' order by ordinal_position`;
console.log("semantic_cache أعمدة:", cols.map(c => `${c.column_name}:${c.data_type}`).join(" | ") || "(الجدول مش موجود)");
try { const n = await sql`select count(*)::int c from semantic_cache`; console.log("عدد الصفوف =", n[0].c); } catch (e) { console.log("قراءة فشلت:", e.message); }
await sql.end();
