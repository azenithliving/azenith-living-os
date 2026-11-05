import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * Which existing papers could serve as the region station's proof — read-only.
 *   node scratch/list-region-candidates.mjs
 *
 * New rows are cheap but they stay in the owner's roll, so this lists what the table already holds:
 * a token (an address the real door opens), a colour pick (evidence for an area), and the papers
 * with no picks (the viewers whose ranking can be measured).
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

const { data: rows, error } = await sb
  .from("room_sketches")
  .select("id,token,room,customer_city,colour_picks,customer_key,ok,created_at")
  .order("id", { ascending: true })
  .limit(500);
if (error) {
  console.log("القراءة مرفوضة:", error.message);
  process.exit(1);
}

let addressable = 0;
let withPicks = 0;
let blank = 0;
console.log("ورقة · عنوان؟ · غرفة · ألوان مختارة · عدد الألوان");
for (const r of rows ?? []) {
  const hasToken = Boolean(r.token);
  const picks = Array.isArray(r.colour_picks) ? r.colour_picks : [];
  if (hasToken) addressable++;
  if (picks.length) withPicks++;
  if (hasToken && !picks.length) blank++;
  if (!hasToken && !picks.length) continue;
  console.log(
    `  ${r.id} · ${hasToken ? "أيوه" : "لأ"} · ${r.room ?? "ولا غرفة"} · ${
      picks.map((p) => `${p?.hex ?? "?"}/${p?.family ?? "?"}`).join(" ") || "فاضي"
    } · ${picks.length}`,
  );
}
console.log(`\nالكل ${(rows ?? []).length} · بعنوان ${addressable} · عنده ألوان ${withPicks} · بعنوان وفاضي الألوان ${blank}`);

const families = new Map();
for (const r of rows ?? []) {
  for (const p of Array.isArray(r.colour_picks) ? r.colour_picks : []) {
    const key = `${p?.hex ?? "?"} ${p?.family ?? "?"}`;
    families.set(key, (families.get(key) ?? 0) + 1);
  }
}
console.log("الألوان الموجودة في الأوراق:");
for (const [k, n] of families) console.log(`  • ${k} (${n})`);
