import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * Is the conversation source feedable at all? — read-only.
 *   node scratch/census-conversation-taste.mjs
 *
 * The radar's second source would be the visitor row: it can carry an area, a room type and a
 * style. A source only counts if the same row holds both halves — an area with no taste feeds
 * nothing. This counts the pairs that really exist, and what the picture bank can be ordered by.
 */
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

const { data: users, error } = await sb
  .from("users")
  .select("id,session_id,area,room_type,style,service_type,budget,tier,intent")
  .limit(500);
if (error) throw new Error(error.message);

const filled = (key) => users.filter((u) => String(u[key] ?? "").trim() !== "").length;
const both = users.filter((u) => String(u.area ?? "").trim() && (String(u.style ?? "").trim() || String(u.room_type ?? "").trim()));
console.log(`سطور الزوار: ${users.length}`);
for (const key of ["area", "room_type", "style", "service_type", "budget", "tier", "intent"]) {
  console.log(`  ${key}: مكتوب في ${filled(key)}`);
}
console.log(`  منطقة + (غرفة أو طراز) في نفس السطر: ${both.length}`);

const tally = new Map();
for (const u of users) {
  const style = String(u.style ?? "").trim() || "—";
  const room = String(u.room_type ?? "").trim() || "—";
  const key = `طراز=${style} · غرفة=${room}`;
  tally.set(key, (tally.get(key) ?? 0) + 1);
}
console.log("\nالقيم المسجلة فعلاً:");
for (const [k, n] of [...tally].sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(`  • ${k} (${n})`);

const { data: styles } = await sb.from("curated_images").select("style,room_type").limit(7000);
const byStyle = new Map();
for (const row of styles ?? []) {
  const s = String(row.style ?? "—");
  byStyle.set(s, (byStyle.get(s) ?? 0) + 1);
}
console.log(`\nالبنك (${(styles ?? []).length} صورة مقروءة) — توزيع الطراز:`);
for (const [s, n] of [...byStyle].sort((a, b) => b[1] - a[1])) console.log(`  • ${s}: ${n}`);
