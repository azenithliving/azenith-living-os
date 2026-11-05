import { readFileSync, existsSync } from "node:fs";

/**
 * Evidence for each old screen: does the new house actually carry what this screen calls?
 *
 * The transfer ledger is generated, but its states come from a hand-written map, and the map stopped
 * being updated on 2026-10-13 — so it says «not moved» for screens the new house has carried for days.
 * This reads the code: the doors a screen reaches (through its own file and the components it imports,
 * two levels deep), and whether any new-house file reaches the same door.
 */
const read = (f) => (existsSync(f) ? readFileSync(f, "utf8") : "");

function resolveImport(spec, fromFile) {
  if (spec.startsWith("@/")) return "app/../" + spec.slice(2);
  if (spec.startsWith(".")) {
    const base = fromFile.split("/").slice(0, -1).join("/");
    const joined = (base + "/" + spec).split("/");
    const out = [];
    for (const part of joined) {
      if (part === "..") out.pop();
      else if (part && part !== ".") out.push(part);
    }
    return out.join("/");
  }
  return null;
}

function withExt(base) {
  for (const e of ["", ".tsx", ".ts", "/index.tsx", "/index.ts", ".jsx"]) {
    const f = base + e;
    if (existsSync(f)) return f;
  }
  return null;
}

function closure(entry, depth = 2) {
  const seen = new Set();
  const stack = [{ file: entry, level: 0 }];
  while (stack.length) {
    const { file, level } = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    if (level >= depth) continue;
    const src = read(file);
    for (const m of src.matchAll(/from ["']([^"']+)["']/g)) {
      const r = resolveImport(m[1], file);
      if (!r) continue;
      if (r.includes("/components/")) {
        const target = withExt(r.replace("app/../", ""));
        if (target && !seen.has(target)) stack.push({ file: target, level: level + 1 });
        continue;
      }
      const target = withExt(r);
      if (target && target.startsWith("lib/") && level < 1) stack.push({ file: target, level: level + 1 });
    }
  }
  return [...seen];
}

function doorsOf(files) {
  const set = new Set();
  for (const f of files) {
    for (const m of read(f).matchAll(/["'`](\/api\/[A-Za-z0-9\-_/[\]]+)/g)) set.add(m[1].replace(/\/+$/, ""));
  }
  return set;
}

import { readdirSync, statSync } from "node:fs";
function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const full = dir + "/" + name;
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(full);
  }
  return acc;
}

const newFiles = walk("app/admin/v2").concat(walk("components/admin/v2"));
const newDoors = doorsOf(newFiles);

const oldPages = walk("app/admin").filter((f) => f.endsWith("page.tsx") && !f.includes("/v2/")).sort();
const report = [];
for (const page of oldPages) {
  const src = read(page);
  const files = closure(page);
  const doors = doorsOf(files);
  const shared = [...doors].filter((d) => newDoors.has(d));
  const onlyOld = [...doors].filter((d) => !newDoors.has(d));
  const forwarder = /redirect\(|router\.replace\(|router\.push\(/.test(src) && src.split("\n").length < 30;
  const retired = /تم إيقاف|retired rather/i.test(src);
  const leaf = page.split("/").slice(-2, -1)[0] === "admin" ? "landing" : page.split("/").slice(-2, -1)[0];
  const twin = existsSync("app/admin/v2/" + leaf + "/page.tsx") || (leaf === "landing" && existsSync("app/admin/v2/page.tsx"));
  const evidence = retired ? "متقاعدة بدليل في الكود" : forwarder ? "محوّل بلا سطح" : twin && doors.size && shared.length === doors.size ? "منقولة: كل أبوابها موجودة في الجديدة" : twin ? "فيها نسخة بالاسم، وأبواب مشتركة " + shared.length + " من " + doors.size : doors.size === 0 ? "مفيش أبواب مقروءة (سطح عرض فقط)" : "لا نسخة ولا أبواب مشتركة";
  report.push({ leaf, page, twin, forwarder, retired, doors: doors.size, shared: shared.length, onlyOld, evidence });
}

for (const r of report) {
  console.log(`${r.leaf.padEnd(18)} نسخة=${r.twin ? "أيوه" : "لأ"} · أبواب=${r.doors} مشتركة=${r.shared} · ${r.evidence}`);
  if (r.onlyOld.length) console.log("     أبواب حصرية للقديمة: " + r.onlyOld.slice(0, 8).join(" , "));
}
console.log("\nعدد الشاشات القديمة: " + report.length + " · منها ليها نسخة: " + report.filter((r) => r.twin).length + " · محوّلات: " + report.filter((r) => r.forwarder).length + " · متقاعدة: " + report.filter((r) => r.retired).length);
