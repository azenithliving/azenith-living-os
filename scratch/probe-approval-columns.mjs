import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config();
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });

const cols = await sql`
  select column_name, data_type from information_schema.columns
  where table_schema = 'public' and table_name = 'approval_requests'
  and column_name in ('action_id', 'action_type', 'description') order by 1`;
console.log("أنواع الأعمدة: " + cols.map((c) => c.column_name + "=" + c.data_type).join(" · "));

const rows = await sql`select action_id, action_type from approval_requests order by requested_at desc limit 3`;
console.log("آخر أسطر مخزنة: " + JSON.stringify(rows));

await sql.end();
