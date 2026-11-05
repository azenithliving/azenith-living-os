import fs from "node:fs";

/**
 * The command prompts the owner's chat shows when he asks for something without the pieces it needs.
 * They were written for a terminal («Usage: add_key <provider> <key>»); he reads Arabic on a phone.
 */
const file = "lib/command-executor.ts";
let source = fs.readFileSync(file, "utf8");

const SWAPS = [
  ['{ success: false, message: "Usage: add_key <provider> <key>" }', '{ success: false, message: "لازم تقول اسم المزوّد والمفتاح نفسه." }'],
  [
    'message: "Usage: simulate_key_usage <provider> <key_id> <percentage>\\nExample: simulate_key_usage groq abc123 96",',
    'message: "لازم تقول اسم المزوّد ورقم المفتاح والنسبة — من صفر لمية.",',
  ],
  ['message: "Percentage must be a number between 0 and 100",', 'message: "النسبة لازم تكون رقم بين صفر ومية.",'],
  ['{ success: false, message: "Usage: remove_key <provider> [key_id]" }', '{ success: false, message: "لازم تقول اسم المزوّد، ومختار رقم المفتاح." }'],
  ['{ success: false, message: "Usage: rate_limit <endpoint> <limit>" }', '{ success: false, message: "لازم تقول اسم الصفحة ورقم السقف." }'],
  ['{ success: false, message: "Usage: send_notification <message>" }', '{ success: false, message: "اكتب الكلام اللي عايز يوصل للفريق." }'],
  ['{ success: false, message: "Usage: restart_service <service>" }', '{ success: false, message: "لازم تقول اسم الخدمة." }'],
  ['{ success: false, message: "Usage: add_backup_key <provider> <key>" }', '{ success: false, message: "لازم تقول اسم المزوّد والمفتاح الاحتياطي." }'],
];

for (const [from, to] of SWAPS) {
  if (!source.includes(from)) throw new Error(`anchor not found: ${from.slice(0, 60)}`);
  source = source.replace(from, to);
}

if (!source.includes('import { arDigits, arNum } from "@/lib/ops/metricLabels";')) {
  const anchor = 'import { readPage, formatPageContent } from "./web-tools";';
  if (!source.includes(anchor)) throw new Error("the import anchor was not found");
  source = source.replace(anchor, `${anchor}\nimport { arDigits, arNum } from "@/lib/ops/metricLabels";`);
}

const left = source.match(/message: "[A-Za-z][^"]*"/g) ?? [];
if (left.length) throw new Error(`English messages remain: ${left.join(" | ")}`);

fs.writeFileSync(file, source, "utf8");
console.log("usage prompts moved to Arabic:", SWAPS.length, "· import added");
