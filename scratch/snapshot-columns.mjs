import postgres from "postgres";
import dotenv from "dotenv";
dotenv.config();
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
const T = ["agent_messages","agent_conversations","agent_profiles","agent_tasks","customer_memory","ops_semantic_memory","ops_sync_events","site_settings","consultant_sessions"];
for (const t of T) {
  const c = await sql`select column_name from information_schema.columns where table_schema='public' and table_name=${t} order by ordinal_position`;
  const names = c.map((x) => x.column_name);
  const key = names.includes("id") ? "id" : names.includes("created_at") ? "created_at" : "بلا مفتاح";
  console.log(t + " cols=" + names.length + " · key=" + key + " · " + names.slice(0, 9).join(","));
}
await sql.end();
