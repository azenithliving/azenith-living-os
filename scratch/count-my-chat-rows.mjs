import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const since = new Date(Date.now() - 90 * 60000).toISOString();
const { data, error } = await sb.from("agent_messages").select("sender_type,sender_name,content,created_at").gte("created_at", since).order("created_at",{ascending:true});
if (error) throw new Error(error.message);
console.log(`rows written in the last 90 minutes: ${data.length}`);
for (const r of data) console.log(`  ${new Date(r.created_at).toISOString().slice(11,19)} ${r.sender_type} · ${String(r.content).replace(/\s+/g," ").slice(0,60)}`);
