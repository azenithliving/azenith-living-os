import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await sb.from("sales_orders").select("status").limit(1000);
if (error) throw new Error(error.message);
const st = new Map();
for (const r of data) st.set(String(r.status), (st.get(String(r.status)) ?? 0) + 1);
console.log(`sales_orders rows ${data.length} · statuses:`, JSON.stringify([...st.entries()]));
