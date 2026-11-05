import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PAGE = 500; const rows = [];
for (let from = 0; ; from += PAGE) {
  const { data, error } = await sb.from("agent_messages").select("content").eq("sender_type", "agent")
    .order("created_at", { ascending: false }).range(from, from + PAGE - 1);
  if (error) throw new Error(error.message);
  rows.push(...data); if (data.length < PAGE) break;
}
let labels = 0, mixed = 0, english = 0, urlOnly = 0;
const englishSamples = [];
for (const r of rows) {
  const raw = String(r.content || "");
  // URLs and paths are allowed on his screen as their own element; they are not the defect.
  const noUrl = raw.replace(/https?:\/\/\S+/g, " ").replace(/\/[A-Za-z0-9\-_./]{4,}/g, " ");
  const words = noUrl.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  if (!words.length) { urlOnly += 1; continue; }
  const latin = words.filter((w) => /^[A-Za-z][A-Za-z0-9_.\-]*$/.test(w));
  const share = latin.length / words.length;
  if (share <= 0.12) labels += 1;
  else if (share >= 0.5) { english += 1; if (englishSamples.length < 4) englishSamples.push(noUrl.replace(/\s+/g, " ").trim().slice(0, 110)); }
  else mixed += 1;
}
console.log(`rows ${rows.length} · latin as labels inside Arabic (<=12% of words) ${labels} · heavy mix ${mixed} · mostly Latin (>=50%) ${english} · no words at all ${urlOnly}`);
for (const s of englishSamples) console.log(`  [mostly Latin] ${s}`);
