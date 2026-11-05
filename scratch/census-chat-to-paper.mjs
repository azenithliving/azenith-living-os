import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * Can a conversation that names an area be tied to a paper? — read-only.
 *   node scratch/census-chat-to-paper.mjs
 *
 * The next atom promises: the customer says his area in chat, the store writes it in the same
 * column the sheet uses. That only holds if the conversation reaches a row that owns an area. This
 * counts the chain link by link, on the store's real rows, before a single line is written.
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

const fold = (s) =>
  String(s ?? "")
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .toLowerCase();

const AREAS = [
  ["التجمع", ["التجمع", "تجمع", "القاهرة الجديدة"]],
  ["الشيخ زايد", ["الشيخ زايد", "زايد"]],
  ["الإسكندرية", ["الإسكندرية", "اسكندرية"]],
  ["الرحاب", ["الرحاب"]],
  ["مدينتي", ["مدينتي"]],
  ["الشروق", ["الشروق"]],
  ["مدينة نصر", ["مدينة نصر"]],
  ["مصر الجديدة", ["مصر الجديدة"]],
  ["المعادي", ["المعادي"]],
  ["الزمالك", ["الزمالك"]],
  ["أكتوبر", ["أكتوبر"]],
  ["الساحل الشمالي", ["الساحل"]],
];

const { data: sessions } = await sb
  .from("consultant_sessions")
  .select("session_id,messages,insights,updated_at")
  .order("updated_at", { ascending: false })
  .limit(500);
console.log("جلسات مقروءة:", (sessions ?? []).length);

const { data: users } = await sb.from("users").select("session_id,phone,full_name,room_type,style").limit(500);
const bySession = new Map((users ?? []).map((u) => [String(u.session_id), u]));
const { data: papers } = await sb.from("room_sketches").select("id,customer_key,customer_city,colour_picks").limit(500);
const keyCount = new Map();
for (const p of papers ?? []) keyCount.set(String(p.customer_key ?? ""), (keyCount.get(String(p.customer_key ?? "")) ?? 0) + 1);

let namedArea = 0;
let tiedUser = 0;
let tiedPhone = 0;
let tiedPaper = 0;
const rows = [];
for (const s of sessions ?? []) {
  const mine = (Array.isArray(s.messages) ? s.messages : [])
    .filter((m) => m?.role === "user")
    .map((m) => fold(m.content))
    .join(" | ");
  const hit = AREAS.find(([, words]) => words.some((w) => mine.includes(fold(w))));
  if (!hit) continue;
  namedArea++;
  const u = bySession.get(String(s.session_id));
  if (u) tiedUser++;
  const digits = String(u?.phone ?? "").replace(/\D/g, "");
  let national = digits;
  if (national.startsWith("0020")) national = national.slice(4);
  else if (national.startsWith("20") && national.length >= 12) national = national.slice(2);
  if (national.startsWith("0")) national = national.slice(1);
  const hasMobile = /^1[0125]\d{8}$/.test(national);
  if (hasMobile) tiedPhone++;
  const hasPaper = hasMobile && keyCount.get(`phone:${national}`) > 0;
  if (hasPaper) tiedPaper++;
  rows.push({ area: hit[0], user: Boolean(u), phone: hasMobile ? "أيوه" : "لأ", paper: hasPaper ? "أيوه" : "لأ" });
}

console.log(`\nالجلسات اللي بتسمّي منطقة: ${namedArea}`);
console.log(`  منها ليها سطر في جدول الزوار: ${tiedUser}`);
console.log(`  ومنها فيها موبايل مكتوب: ${tiedPhone}`);
console.log(`  ومنها اللي يقدر يوصل لورقة: ${tiedPaper}`);
console.log("\nأول ١٢ حالة:");
for (const r of rows.slice(0, 12)) console.log(`  • ${r.area} · سطر زوار=${r.user ? "أيوه" : "لأ"} · موبايل=${r.phone} · ورقة=${r.paper}`);

const { data: withPhone } = await sb.from("users").select("phone", { count: "exact", head: true }).not("phone", "is", null).limit(1);
const { count: userCount } = await sb.from("users").select("id", { count: "exact", head: true }).limit(1);
console.log(`\nجدول الزوار: ${userCount ?? "?"} سطر · اللي عليه موبايل: ${withPhone?.length ?? "?"}`);
const { data: keys } = await sb.from("room_sketches").select("customer_key", { count: "exact", head: true }).not("customer_key", "is", null).limit(1);
console.log(`ورقات عليها مفتاح عميل: ${keys?.count ?? "?"}`);
