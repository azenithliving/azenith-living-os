import { config as loadEnv } from "dotenv";
import postgres from "postgres";
loadEnv({ path: ".env.local" });
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
const cols = await sql`select column_name from information_schema.columns where table_schema='public' and table_name='consultant_sessions' order by ordinal_position`;
console.log("consultant_sessions أعمدة:", cols.map(c => c.column_name).join(" | "));
await sql.end();
