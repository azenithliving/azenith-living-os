import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await sb.from("agent_messages").select("created_at,sender_name,context,content").eq("sender_type","agent").order("created_at",{ascending:false}).limit(900);
if (error) throw new Error(error.message);
const hits = (data??[]).filter(r => /مخزون|متوفر|جاهز للتسليم/.test(String(r.content||"")));
for (const r of hits.slice(0,8)) console.log(`${r.created_at} · ${r.sender_name} · tool=${r.context?.tool ?? "—"} · ${String(r.content).replace(/\s+/g," ").slice(0,80)}`);
const tools = new Map();
for (const r of data??[]) { const t = r.context?.tool; if (t) tools.set(t, (tools.get(t)??0)+1); }
console.log("\ndesk ids seen in stored rows:", [...tools.entries()].sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}=${v}`).join(", "));
