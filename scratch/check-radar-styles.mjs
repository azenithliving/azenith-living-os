import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
/**
 * Did the requested style actually move the pictures? — read-only.
 *   node scratch/check-radar-styles.mjs
 * The bank keys its pictures by style; the sheet's top pictures are named by file. This prints the
 * style of each of the top six so a claim about ordering can be checked against what is on screen.
 */
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const IDS = [18285957, 38697210, 6394607, 37429730, 38697212, 35189671];
const { data, error } = await db.from("curated_images").select("id,style,room_type,quality_score").in("id", IDS);
if (error) throw new Error(error.message);
const byId = new Map((data ?? []).map((r) => [Number(r.id), r]));
for (const id of IDS) {
  const r = byId.get(id);
  console.log(`  ${id}: طراز=${r?.style ?? "مش موجود في البنك"} · غرفة=${r?.room_type ?? "-"}`);
}
