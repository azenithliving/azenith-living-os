import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * Waits until the published sheet names the second door in its line.
 *   node scratch/wait-radar-live.mjs
 *
 * The predicate is the claim itself — the sentence must contain «طراز» — not a marker that could
 * be true while the fix is still not serving. The token is read from the table, never typed.
 */
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: paper } = await db.from("room_sketches").select("token").eq("id", 118).maybeSingle();
if (!paper?.token) throw new Error("مفيش عنوان للورقة 118");

for (let i = 1; i <= 14; i++) {
  const body = await fetch(`https://azenith-living.vercel.app/api/passport/${paper.token}`, { cache: "no-store" })
    .then((r) => r.text())
    .catch(() => "");
  const line = (body.match(/"line":"([^"]*)"/) ?? [])[1] ?? "";
  console.log(`محاولة ${i}: ${line || "الصف ما جاوبش"}`);
  if (line.includes("طراز")) {
    console.log("البناء الجديد رد.");
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 45000));
}
process.exit(1);
