import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { ownerVoice } from "@/lib/ops/owner-voice";
dotenv.config({ path: ".env.local" });
async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await sb.from("agent_messages").select("id,created_at,content")
    .in("id", ["366a3930-53cc-4afe-b367-45be845fc2f1","ebd283b6-0000-0000-0000-000000000000"]).order("created_at",{ascending:false}).limit(2);
  if (error) throw new Error(error.message);
  for (const r of data!) {
    const spoken = ownerVoice(String(r.content));
    console.log(`${r.id.slice(0,8)} · ${r.created_at}`);
    console.log("  قبل:", String(r.content).replace(/\s+/g," ").slice(0,120));
    console.log("  بعد:", spoken.replace(/\s+/g," ").slice(0,120));
    console.log("  لاتيني فاضل:", (spoken.match(/[0-9]/g) ?? []).length);
  }
}
main().catch(e=>{console.error(e);process.exit(1);});
