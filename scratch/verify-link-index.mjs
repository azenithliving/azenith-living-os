import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import postgres from "postgres";
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local") });
const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL, { ssl: "require", max: 1 });
const rows = await sql`select indexname, indexdef from pg_indexes where tablename = 'room_sketches' order by indexname`;
for (const r of rows) console.log(r.indexname, '|', r.indexdef);
await sql.end();
