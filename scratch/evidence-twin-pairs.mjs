import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";

/**
 * For every old screen that has a twin in the new house: which pieces of furniture each one renders,
 * and which pieces only the old house can still reach. Door-sharing alone under-detects a move,
 * because the new screens read their data on the server; the component a screen renders is the second
 * witness. Nothing here decides a state — it prints the evidence a human reads before claiming a move.
 */
const read = (f) => (existsSync(f) ? readFileSync(f, "utf8") : "");
const norm = (p) => p.split("\\").join("/");
function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const full = norm(dir + "/" + name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.tsx?$/.test(name)) acc.push(full);
  }
  return acc;
}
function resolveImport(spec, fromFile) {
  if (spec.startsWith("@/")) return spec.slice(2);
  if (spec.startsWith(".")) {
    const parts = (fromFile.split("/").slice(0, -1).join("/") + "/" + spec).split("/");
    const out = [];
    for (const p of parts) { if (p === "..") out.pop(); else if (p && p !== ".") out.push(p); }
    return out.join("/");
  }
  return null;
}
function withExt(base) {
  for (const e of ["", ".tsx", ".ts", "/index.tsx", "/index.ts"]) if (existsSync(base + e)) return base + e;
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
    for (const m of read(file).matchAll(/from ["']([^"']+)["']/g)) {
      const r = resolveImport(m[1], file);
      if (!r || !(r.startsWith("components/") || r.startsWith("lib/"))) continue;
      const t = withExt(r);
      if (t && !seen.has(t)) stack.push({ file: t, level: level + 1 });
    }
  }
  return [...seen];
}
const furnitureOf = (entry) => new Set(closure(entry, 3).filter((f) => f.startsWith("components/")).map((f) => f.split("/").pop()));
const doorsOf = (entry) => new Set(closure(entry, 3).flatMap((f) => [...read(f).matchAll(/["'`](\/api\/[A-Za-z0-9\-_/[\]]+)/g)].map((m) => m[1].replace(/\/+$/, ""))));

const oldPages = walk("app/admin").filter((f) => f.endsWith("page.tsx") && !f.includes("/v2/")).sort();
// The new house is not a folder — it is every file the new screens actually reach. Measuring it as
// `components/admin/v2/**` alone declared the moved chat panel «old-only», because the new cockpit
// imports it from `components/admin/agents/`.
const newPages = walk("app/admin/v2").filter((f) => f.endsWith("page.tsx"));
const newClosure = new Set(newPages.flatMap((p) => closure(p, 3)));
const newAllDoors = new Set([...newClosure].flatMap((f) => [...read(f).matchAll(/["'`](\/api\/[A-Za-z0-9\-_/[\]]+)/g)].map((m) => m[1].replace(/\/+$/, ""))));
const newAllFurniture = new Set([...newClosure].filter((f) => f.startsWith("components/")).map((f) => f.split("/").pop()));
console.log("ملفات الجديدة الموصلة: " + newClosure.size + " · عفش " + newAllFurniture.size + " · أبواب " + newAllDoors.size + "\n");

for (const page of oldPages) {
  const leaf = page.split("/").slice(-2, -1)[0] === "admin" ? "landing" : page.split("/").slice(-2, -1)[0];
  const twinPath = leaf === "landing" ? "app/admin/v2/page.tsx" : `app/admin/v2/${leaf}/page.tsx`;
  if (!existsSync(twinPath)) continue;
  const oldF = [...furnitureOf(page)];
  const oldD = [...doorsOf(page)];
  const sharedF = oldF.filter((f) => newAllFurniture.has(f));
  const sharedD = oldD.filter((d) => newAllDoors.has(d));
  console.log(`${leaf.padEnd(16)} عفش مشترك ${sharedF.length}/${oldF.length} · أبواب مشتركة ${sharedD.length}/${oldD.length}`);
  const onlyF = oldF.filter((f) => !sharedF.includes(f));
  if (onlyF.length) console.log("     عفش محصور في القديمة: " + onlyF.slice(0, 6).join(" , "));
  const onlyD = oldD.filter((d) => !sharedD.includes(d));
  if (onlyD.length) console.log("     أبواب محصورة في القديمة: " + onlyD.slice(0, 6).join(" , "));
}
