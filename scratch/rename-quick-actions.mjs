import fs from "node:fs";

/**
 * Renames the seven quick-action labels that carried English machine words, and refuses to write
 * unless every one of them is actually present — a silent no-match here would leave the drawer
 * half-translated and the guard red for the wrong reason.
 */
const p = "lib/ops/agent-roles.ts";
const pairs = [
  ["أصلح مشاكل SEO للمحتوى الحالي", "أصلح مشاكل الظهور في نتائج البحث للمحتوى الحالي"],
  ["أصلح مشاكل SEO للموقع", "أصلح مشاكل الظهور في نتائج البحث للموقع"],
  ["افحص SEO للصفحة الرئيسية الآن", "افحص الظهور في نتائج البحث للصفحة الرئيسية الآن"],
  ["راجع نص صفحة About واقترح نسخة أفخم", "راجع نص صفحة من نحن واقترح نسخة أفخم"],
  ["اكتب alt text عربي محسّن لصور غرفة المعيشة", "اكتب الوصف البديل العربي لصور غرفة المعيشة"],
  ["احسب Luxury Score الآن للموقع كله", "احسب درجة الفخامة الآن للموقع كله"],
  ["افحص مفاتيح الـ API", "افحص حالة مفاتيحك"],
];

let src = fs.readFileSync(p, "utf8");
const missing = pairs.filter(([from]) => !src.includes(from)).map(([from]) => from);
if (missing.length) throw new Error(`labels not found, refusing to write: ${missing.join(" | ")}`);
for (const [from, to] of pairs) src = src.split(from).join(to);
if (/[A-Za-z]{3,}/.test(src.replace(/^[\s\S]*?export const AGENT_ROLES/, ""))) {
  const left = [...src.matchAll(/"([^"]*[A-Za-z]{3,}[^"]*)"/g)].map((m) => m[1]).filter((s) => !/ops-|vanguard|^م/.test(s) && /[A-Za-z]{3,}/.test(s) && !s.startsWith("ops"));
  console.log("still carrying Latin:", JSON.stringify(left));
}
fs.writeFileSync(p, src);
console.log("renamed:", pairs.length);
