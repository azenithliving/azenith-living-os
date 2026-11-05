import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await sb.from("ops_sync_events").select("created_at,payload").eq("event_type","context_update").order("created_at",{ascending:false}).limit(25);
if (error) throw new Error(error.message);
const hit = (data||[]).find((r) => r?.payload?.kind === "daily_round");
if (!hit) { console.log("no daily_round event in the last 25 context updates"); process.exit(0); }
const hours = (Date.now() - new Date(hit.created_at).getTime()) / 3600e3;
console.log(`last daily_round landed: ${hit.created_at}`);
console.log(`age: ${hours.toFixed(1)} hours · overdue past 28 hours: ${hours > 28 ? "نعم" : "لا"}`);
