import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await sb
  .from("agent_messages")
  .select("id,sender_name,created_at,content,context,action_taken")
  .eq("sender_type", "agent")
  .order("created_at", { ascending: false })
  .limit(8);
if (error) throw new Error(error.message);
for (const r of data) {
  console.log("=====", r.created_at, "|", r.sender_name, "| action_taken:", JSON.stringify(r.action_taken));
  console.log("context:", JSON.stringify(r.context));
  console.log("body:", String(r.content ?? "").replace(/\s+/g, " ").slice(0, 260));
}
