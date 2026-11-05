import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await sb.from("room_sketches").select("id,token,pulse_sent_at,room,created_at").like("token","GbKYqC%").limit(3);
if (error) throw new Error(error.message);
for (const r of data) console.log(`id=${r.id} · الختم: ${r.pulse_sent_at ?? "فاضي"} · الغرفة: ${r.room ?? "—"} · اتعملت: ${r.created_at}`);
