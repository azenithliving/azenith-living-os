import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { ownerVoice, voiceTally } from "@/lib/ops/owner-voice";
dotenv.config({ path: ".env.local" });

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await sb.from("agent_messages").select("created_at,content")
    .eq("sender_type","agent").order("created_at",{ascending:false}).limit(6);
  if (error) throw new Error(error.message);
  for (const r of data!) {
    const spoken = ownerVoice(String(r.content));
    const latinLeft = (spoken.match(/[0-9]/g) ?? []).length;
    console.log(`${r.created_at} · حروف لاتينية بعد الصوت: ${latinLeft} · tally=${JSON.stringify(voiceTally(String(r.content)).digits)}`);
    const m = spoken.match(/.{0,40}[0-9].{0,30}/);
    if (m) console.log(`   عينة: «${m[0].replace(/\s+/g," ")}»`);
  }
}
main().catch(e => { console.error("failed:", e?.message ?? e); process.exit(1); });
