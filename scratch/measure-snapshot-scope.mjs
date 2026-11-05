import { config as loadEnv } from "dotenv";
import postgres from "postgres";
loadEnv({ path: ".env.local" });
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
const targets = ["agent_messages","agent_conversations","agent_profiles","agent_tasks","consultant_sessions","consultant_learnings","consultant_pending_questions","customer_memory","ops_semantic_memory","ops_sync_events","site_settings"];
let total = 0n;
for (const t of targets) {
  const r = await sql`select pg_total_relation_size(${t})::bigint s`;
  total += BigInt(r[0].s);
}
const pic = await sql`select pg_total_relation_size('curated_images')::bigint s`;
console.log("عدد الجداول في النسخة =", targets.length);
console.log("حجمها على القرص بايت =", String(total));
console.log("بنك الصور بايت =", String(pic[0].s));
await sql.end();
