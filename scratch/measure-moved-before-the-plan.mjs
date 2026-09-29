// Read-only: for every new-house page, is it a real surface or an empty shell?
// And which old page does it duplicate — that pair is a move that already happened.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const norm = (p) => p.split("\\").join("/");
const walk = (d, acc = []) => {
  if (!statSync(d, { throwIfNoEntry: false })?.isDirectory()) return acc;
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(norm(p));
  }
  return acc;
};
const pages = (root) => walk(root).filter((f) => f.endsWith("page.tsx"));
const lines = (f) => readFileSync(f, "utf8").split("\n").length;

const oldPages = pages("app/admin").filter((f) => !f.includes("/v2/"));
const newPages = pages("app/admin/v2");

// A shell is a page that fetches nothing and renders nothing of its own: no fetch,
// no state, no import from the furniture tree.
const verdict = (f) => {
  const t = readFileSync(f, "utf8");
  const callsDoor = /fetch\(|useSWR|serverComponent|getServerSide/i.test(t);
  const furniture = (t.match(/from ["']@\/components\/admin/g) || []).length;
  const state = /useState|useEffect/.test(t);
  const words = (t.match(/[\u0600-\u06FF]{3,}/g) || []).length;
  const kind = callsDoor || furniture > 0 || state ? "surface" : "shell";
  return { kind, furniture, callsDoor, words };
};

console.log("=== new house ===");
for (const f of newPages) {
  const v = verdict(f);
  console.log(`${f.padEnd(46)} ${String(lines(f)).padStart(4)} lines  ${v.kind}  furniture=${v.furniture} door=${v.callsDoor ? "yes" : "no"} arabicWords=${v.words}`);
}

console.log("\n=== retired word inside the NEW house (the clause says it must know none) ===");
for (const f of [...newPages, ...walk("app/admin/v2").filter((x) => /\.tsx?$/.test(x) && !x.endsWith("page.tsx"))]) {
  const t = readFileSync(f, "utf8");
  const hits = (t.match(/[Qq]ayyim|qayyim_|قيّم الدار/g) || []);
  if (hits.length) console.log(`${f.padEnd(46)} ${hits.length} x  ${[...new Set(hits)].join(", ")}`);
}
console.log("\n=== old pages with a same-named twin in the new house ===");
for (const o of oldPages) {
  const leaf = o.split("/").slice(-2, -1)[0];
  const twin = newPages.find((n) => n.split("/").slice(-2, -1)[0] === leaf);
  if (twin) {
    const v = verdict(twin);
    console.log(`${leaf.padEnd(14)} old=${String(lines(o)).padStart(4)} lines   new=${twin} (${lines(twin)} lines, ${v.kind})`);
  }
}
