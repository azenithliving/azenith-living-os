import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const since = new Date(Date.now() - 40 * 60000).toISOString();
const { data, error } = await sb.from("agent_messages").select("id,sender_name,content,context,created_at").eq("sender_type","agent").gte("created_at", since).order("created_at",{ascending:false});
if (error) throw new Error(error.message);
console.log(`agent rows in the last 40 minutes: ${data.length}`);
for (const r of data) {
  console.log(`\n[${new Date(r.created_at).toISOString().slice(11,19)}] ${r.sender_name}`);
  console.log(`  context keys: ${Object.keys(r.context || {}).join(", ") || "ولا حاجة"}`);
  console.log(`  action_taken-ish: tool=${r.context?.tool ?? "—"} success=${r.context?.success ?? "—"}`);
  console.log(`  content: ${String(r.content).replace(/\s+/g," ").slice(0,200)}`);
}
