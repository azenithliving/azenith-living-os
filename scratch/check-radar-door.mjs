import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
/**
 * What the sheet door really returns: the taste it claims and the styles it actually sent.
 *   node scratch/check-radar-door.mjs
 */
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
for (const id of [118, 119]) {
  const { data: paper } = await db.from("room_sketches").select("token").eq("id", id).maybeSingle();
  const body = await fetch(`https://azenith-living.vercel.app/api/passport/${paper.token}`, { cache: "no-store" }).then((r) => r.json());
  const styles = (body.images ?? []).slice(0, 8).map((im) => im.style ?? "-");
  console.log(`ورقة ${id}: ${body.taste?.source} · ${body.taste?.line}`);
  console.log(`   طرازات أول تمن: ${styles.join(", ")}`);
  console.log(`   عدد الصور ${body.images?.length}`);
}
