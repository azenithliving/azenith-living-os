import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
dotenv.config({ path: ".env.local" });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const all = await sb.storage.listBuckets();
if (all.error) console.log("ERR", all.error.message);
else console.log("buckets=" + all.data.length + " :: " + all.data.map((b) => b.name + (b.public ? "(عام)" : "(خاص)") + ":" + (b.file_size_limit ? Math.round(b.file_size_limit / 1048576) + "MB" : "بلاحد")).join(" · "));
