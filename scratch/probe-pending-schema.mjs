import { config as loadEnv } from "dotenv";
import postgres from "postgres";
loadEnv({ path: ".env.local" });
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
const cols = await sql`select column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' and table_name='consultant_pending_questions' order by ordinal_position`;
for (const c of cols) console.log(`${c.column_name} : ${c.data_type} : null=${c.is_nullable} : def=${c.column_default ?? "-"}`);
const n = await sql`select status, count(*)::int c from consultant_pending_questions group by status order by 2 desc`;
console.log("الحالات:", n.map(r => `${r.status}=${r.c}`).join(" · "));
await sql.end();
