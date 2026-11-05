import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * How many real conversations name an area, and does taste data sit next to them? — read-only.
 *   node scratch/census-session-areas.mjs
 *
 * The region station was going to depend on papers carrying a city, and zero papers do. But the
 * advisor's own transcripts are full of customers naming their area in their words. This counts
 * what is really there, and whether a named area joins to a taste record (style, room, budget),
 * because a ranking is only honest when both sides exist for the same customer.
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

const AREAS = [
  ["التجمع", ["التجمع", "تجمع", "القاهرة الجديدة"]],
  ["الرحاب", ["الرحاب", "رحاب"]],
  ["مدينتي", ["مدينتي"]],
  ["الشروق", ["الشروق", "شروق"]],
  ["مدينة نصر", ["مدينة نصر"]],
  ["مصر الجديدة", ["مصر الجديدة", "مصر الجديده"]],
  ["المعادي", ["المعادي", "معادي"]],
  ["الزمالك", ["الزمالك", "زمالك"]],
  ["الشيخ زايد", ["الشيخ زايد", "زايد"]],
  ["أكتوبر", ["أكتوبر", "اكتوبر", "حدائق أكتوبر"]],
  ["الهرم", ["الهرم"]],
  ["المهندسين", ["المهندسين", "الهرم والمهندسين"]],
  ["الإسكندرية", ["الإسكندرية", "اسكندرية", "السكندرية"]],
  ["الساحل الشمالي", ["الساحل", "السخنة", "عين سحنة", "العين السخنة"]],
  ["حلوان", ["حلوان"]],
  ["العبور", ["العبور"]],
  ["العاشر", ["العاشر", "العاشر من رمضان"]],
  ["بورسعيد", ["بورسعيد"]],
  ["المنصورة", ["المنصورة"]],
  ["طنطا", ["طنطا"]],
  ["أسيوط", ["أسيوط"]],
  ["أسوان", ["أسوان"]],
  ["الأقصر", ["الأقصر"]],
  ["دمياط", ["دمياط"]],
];

function foldAr(s) {
  return String(s ?? "")
    .replace(/[إأآا]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ًٌٍَُِّْ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const { data: sessions } = await sb
  .from("consultant_sessions")
  .select("session_id,messages,insights,ui_state,created_at")
  .order("created_at", { ascending: false })
  .limit(400);

console.log("جلسات مقروءة:", (sessions ?? []).length);

const areaRows = new Map();
let withUserMsg = 0;
for (const s of sessions ?? []) {
  const msgs = Array.isArray(s.messages) ? s.messages : [];
  const mine = msgs.filter((m) => m?.role === "user").map((m) => foldAr(m.content)).join(" | ");
  if (mine) withUserMsg++;
  const hit = new Set();
  for (const [label, words] of AREAS) {
    for (const w of words) if (mine.includes(foldAr(w))) hit.add(label);
  }
  for (const label of hit) {
    const list = areaRows.get(label) ?? [];
    list.push(s.session_id);
    areaRows.set(label, list);
  }
}
console.log("جلسات فيها رسالة عميل:", withUserMsg);
console.log("\nالمناطق اللي اتقالت فعلاً في كلام العملاء:");
for (const [label, ids] of [...areaRows].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  • ${label}: ${ids.length} جلسة`);
}

const { data: users } = await sb.from("users").select("session_id,room_type,style,budget,tier,intent,last_page").limit(200);
console.log(`\n صفوف زوار: ${(users ?? []).length} · اللي عليها جلسة مطابقة:`);
const idSet = new Set();
for (const ids of areaRows.values()) for (const i of ids) idSet.add(i);
let joined = 0;
const tasteByArea = new Map();
for (const u of users ?? []) {
  if (!idSet.has(u.session_id)) continue;
  joined++;
  const style = String(u.style ?? "").trim();
  tasteByArea.set(style, (tasteByArea.get(style) ?? 0) + 1);
}
console.log("  عدد الزوار اللي منطقته اتقالت في الشات:", joined);
console.log("  الستايلات المسجلة:", JSON.stringify([...tasteByArea]));

const { data: uiSample } = await sb.from("consultant_sessions").select("ui_state").not("ui_state", "is", null).limit(3);
console.log("\n شكل ui_state (مقطوع، بلا بيانات شخصية):");
for (const r of uiSample ?? []) console.log("  ", JSON.stringify(r.ui_state).replace(/\s+/g, " ").slice(0, 160));
const { data: insSample } = await sb.from("consultant_sessions").select("insights").not("insights", "is", null).limit(3);
console.log(" شكل insights:");
for (const r of insSample ?? []) console.log("  ", JSON.stringify(r.insights).replace(/\s+/g, " ").slice(0, 200));
