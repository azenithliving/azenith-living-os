import fs from "node:fs";

/** Drops the arrow glyph from the chat's hint line — an arrow inside an Arabic line reads scrambled to him. */
const p = "components/admin/agents/ChatPanel.tsx";
const from = 'باهت" → أفهم';
const to = 'باهت» — أفهم';
let s = fs.readFileSync(p, "utf8");
if (!s.includes(from)) throw new Error("the hint line is not where it was measured — refusing");
s = s.replace(from, to);
s = s.replace('"الجزء اللي فوق باهت', '«الجزء اللي فوق باهت');
fs.writeFileSync(p, s);
const after = fs.readFileSync(p, "utf8");
const line = after.split(/\r?\n/).find((l) => l.includes("تلميح"));
console.log("hint line now:", line?.trim().slice(0, 120));
console.log("arrows left in that line:", (line.match(/[→←↑↓]/g) ?? []).length);
