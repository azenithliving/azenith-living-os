import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const drafts = await sb.from("ops_drafts").select("draft_type,target_path").limit(1000);
if (drafts.error) console.log("ops_drafts:", drafts.error.message);
else {
  const types = new Map(), paths = new Map();
  for (const r of drafts.data) {
    types.set(String(r.draft_type), (types.get(String(r.draft_type)) ?? 0) + 1);
    paths.set(String(r.target_path), (paths.get(String(r.target_path)) ?? 0) + 1);
  }
  console.log(`draft rows ${drafts.data.length}`);
  console.log("draft_type:", JSON.stringify([...types.entries()]));
  console.log("target_path:", JSON.stringify([...paths.entries()].slice(0, 20)));
}

const orders = await sb.from("orders").select("status").limit(1000);
if (orders.error) console.log("orders:", orders.error.message);
else {
  const st = new Map();
  for (const r of orders.data) st.set(String(r.status), (st.get(String(r.status)) ?? 0) + 1);
  console.log(`order rows ${orders.data.length} · status:`, JSON.stringify([...st.entries()]));
}
