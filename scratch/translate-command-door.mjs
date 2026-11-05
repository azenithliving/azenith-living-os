import { readFileSync, writeFileSync } from "node:fs";

/**
 * The command door answers him in his language.
 *
 * Measured by reading the source of the door the command console calls: nine refusals were written in
 * English («Unauthorized», «Command not allowed. Contact system administrator.»), and the console
 * prints whatever the door says. One was already fixed by hand; this closes the rest, and stops if any
 * anchor is not exactly one occurrence — a silent miss here would leave a refusal he cannot read.
 */
const FILE = "app/api/admin/command/route.ts";

const PAIRS = [
  ['{ error: "Unauthorized - Authentication required" }', '{ error: "لازم تسجّل الدخول الأول" }'],
  ['{ error: "Command is required" }', '{ error: "مفيش أمر مكتوب" }'],
  ['{ error: "Digital signature is required" }', '{ error: "التوقيع الرقمي مطلوب" }'],
  ['{ error: "No public key found. Please setup digital signatures first." }', '{ error: "مفيش مفتاح عام مسجّل — ظبّط التواقيع الرقمية الأول" }'],
  ['{ error: "Invalid digital signature. This incident has been logged." }', '{ error: "التوقيع الرقمي غير سليم — والمحاولة اتسجّلت" }'],
  ['{ error: "Command not allowed. Contact system administrator." }', '{ error: "الأمر ده مش مسموح — كلّم مسؤول النظام" }'],
  ['{ error: "Unauthorized" }', '{ error: "لازم تسجّل الدخول" }'],
  ['{ error: "Failed to fetch command history" }', '{ error: "سجل الأوامر ما جاش" }'],
  ['{ error: "Internal server error" }', '{ error: "حصل خطأ في السيرفر" }'],
];

let text = readFileSync(FILE, "utf8");
const bad = [];
const counts = [];
for (const [from, to] of PAIRS) {
  const hits = text.split(from).length - 1;
  // «Internal server error» is the fallback of two handlers, so more than one occurrence is expected;
  // zero is not, and that is the only case where a rename would have silently missed.
  if (hits < 1) bad.push(`missing: ${from}`);
  counts.push([from.slice(0, 46), hits]);
  text = text.split(from).join(to);
}
if (bad.length) {
  console.log("ABORTED, nothing written:");
  for (const b of bad) console.log("  - " + b);
  process.exit(1);
}

const left = text.match(/error:\s*"[A-Za-z][A-Za-z .,'-]{8,}"/g) ?? [];
if (left.length) {
  console.log("still English:");
  for (const l of left) console.log("  - " + l);
}

writeFileSync(FILE, text, "utf8");
const after = readFileSync(FILE, "utf8");
for (const [from, hits] of counts) console.log(`  ${hits} × ${from}`);
console.log(`written. English error literals left: ${(after.match(/error:\s*"[A-Za-z][A-Za-z .,'-]{8,}"/g) ?? []).length}`);
