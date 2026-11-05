import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
loadEnv({ path: ".env.local" });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const b = await sb.storage.listBuckets();
console.log("الدرجات:", (b.data ?? []).map((x) => `${x.name}${x.public ? "(عام)" : "(خاص)"}`).join(" · ") || "(ولا واحدة)");
for (const n of ["images", "curated-images"]) {
  const r = await sb.storage.from(n).list("", { limit: 3 });
  console.log(`درج ${n}:`, r.error ? `مرفوض — ${r.error.message}` : `${(r.data ?? []).length} عنصر أولي`);
}
