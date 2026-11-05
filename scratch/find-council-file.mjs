import fs from "node:fs";
import path from "node:path";

const roots = ["C:/Users/noura/OneDrive", "C:/Users/noura/Desktop", "C:/Users/noura/Documents", "C:/Users/noura/Downloads", "D:/alaa2"];
const skip = /node_modules|\.git|\.next|AppData|OneDriveTemp|Packages/i;
const hits = [];
const walk = (dir, depth) => {
  if (depth > 4 || hits.length > 8) return;
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (/جتماع|محضر/.test(e.name)) hits.push(`${e.isDirectory() ? "مجلد" : "ملف"}: ${p}`);
    if (e.isDirectory() && !skip.test(e.name)) walk(p, depth + 1);
  }
};
for (const r of roots) walk(r, 0);
console.log(hits.length ? hits.join("\n") : "مفيش حاجة بالاسم ده في النطاقات اللي بحثت فيها");
