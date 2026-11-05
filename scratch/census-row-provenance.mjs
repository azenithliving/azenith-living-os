/**
 * Provenance census, read the way the writers write.
 * Counts every agent row by the SHAPE of its `context` column, and separates the
 * rows that claim a deed from the rows that carry a record of one.
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PAGE = 500;
const rows = [];
for (let from = 0; ; from += PAGE) {
  const { data, error } = await sb
    .from("agent_messages")
    .select("id,sender_name,created_at,context,action_taken,requires_action")
    .eq("sender_type", "agent")
    .order("created_at", { ascending: false })
    .range(from, from + PAGE - 1);
  if (error) throw new Error(error.message);
  rows.push(...data);
  if (data.length < PAGE) break;
}

function shapeOf(row) {
  const c = row.context;
  if (c === null || c === undefined) return "null";
  if (Array.isArray(c)) return "array";
  if (typeof c !== "object") return "not-an-object";
  const keys = Object.keys(c);
  if (keys.length === 0) return "empty {}";
  if (keys.includes("tool")) return "has tool";
  return "other keys: " + keys.slice(0, 3).join(",");
}

const shapes = new Map();
for (const r of rows) {
  const s = shapeOf(r);
  shapes.set(s, (shapes.get(s) ?? 0) + 1);
}

const CLAIM = /فعّلنا|تم تنفيذ|تمّ تنفيذ|شغّلنا|نفّذت|نفّذنا|قمت ب|قام الوكلاء|توزيع الأدوار|جاهز|تغيير/;
const withClaim = rows.filter((r) => CLAIM.test(String(r.content ?? "")));
const claimNoRecord = withClaim.filter((r) => !r.context?.tool);

const hours = new Map();
for (const r of rows) {
  const h = new Date(r.created_at);
  if (Number.isNaN(h.getTime())) continue;
  const k = h.toISOString().slice(0, 13);
  hours.set(k, (hours.get(k) ?? 0) + 1);
}
const recentHours = [...hours.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 6);

console.log(`agent rows read: ${rows.length}`);
console.log("context shapes:", JSON.stringify(Object.fromEntries(shapes)));
console.log(`rows claiming a deed: ${withClaim.length} — of which with no desk record: ${claimNoRecord.length}`);
console.log("action_taken true:", rows.filter((r) => r.action_taken === true).length);
console.log("last hours written:", JSON.stringify(recentHours));
for (const r of claimNoRecord.slice(0, 5)) {
  console.log("---");
  console.log(r.created_at, "|", String(r.content ?? "").replace(/\s+/g, " ").slice(0, 110));
  console.log("context:", JSON.stringify(r.context));
}
