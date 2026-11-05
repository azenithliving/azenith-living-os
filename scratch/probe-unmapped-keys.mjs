import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const read = async (col) => {
  const out = new Map();
  for (let from = 0; from < 1000; from += 500) {
    const { data } = await supabase.from("image_style_dictionary").select(col, { count: "exact" }).range(from, from + 499);
    if (!data?.length) break;
    for (const row of data) out.add?.(row[col]);
  }
  return out;
};
// The dictionary table may not be the source; ask the curated images directly for distinct values.
const rooms = new Map();
const styles = new Map();
for (let from = 0; from < 6000; from += 500) {
  const { data } = await supabase.from("curated_images").select("room_type,style").eq("is_active", true).range(from, from + 499);
  if (!data?.length) break;
  for (const r of data) {
    rooms.set(r.room_type, (rooms.get(r.room_type) ?? 0) + 1);
    styles.set(r.style, (styles.get(r.style) ?? 0) + 1);
  }
}
console.log("room_types:", JSON.stringify([...rooms.entries()].sort((a, b) => b[1] - a[1])));
console.log("styles:", JSON.stringify([...styles.entries()].sort((a, b) => b[1] - a[1])));
