import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
for (const table of ["room_sections","site_sections"]) {
  const { data, error, count } = await sb.from(table).select("*",{count:"exact"}).limit(2);
  if (error) { console.log(`${table}: ${error.code} — ${error.message}`); continue; }
  console.log(`${table}: ${count} سطر · أعمدة: ${(data??[])[0] ? Object.keys(data[0]).join(", ") : "مفيش صفوف"}`);
  for (const r of data ?? []) console.log("  ", JSON.stringify(Object.fromEntries(Object.entries(r).map(([k,v])=>[k, typeof v==="string"? v.slice(0,45): v]))).slice(0,600));
}
