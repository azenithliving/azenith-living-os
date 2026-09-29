// Read-only: which atoms sit outside the census fence but run an office?
// The census counts admin doors only; this measures what admin surfaces actually call.
import { readFileSync, readdirSync } from "node:fs";

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(p, out);
    else out.push(p.replaceAll("\\", "/"));
  }
  return out;
};

const linesOf = (f) => readFileSync(f, "utf8").split("\n").length;

const adminSurface = [...walk("app/admin"), ...walk("components/admin")].filter((f) => /\.tsx?$/.test(f));
const adminDoors = walk("app/api").filter((f) => f.endsWith("route.ts") && f.startsWith("app/api/admin/"));
const sources = [...adminSurface, ...adminDoors];
const blob = sources.map((f) => readFileSync(f, "utf8")).join("\n");

const nonAdmin = walk("app/api").filter((f) => f.endsWith("route.ts") && !f.startsWith("app/api/admin/"));
const called = nonAdmin.filter((f) => {
  const spec = "/" + f.replace(/^app\//, "").replace(/\/route\.ts$/, "");
  const quoted = [`"${spec}`, `'${spec}`, "`" + spec];
  return quoted.some((needle) => blob.includes(needle));
});

console.log(`admin surfaces+doors scanned: ${sources.length}`);
console.log(`non-admin doors total: ${nonAdmin.length}`);
console.log(`non-admin doors called from an admin surface: ${called.length}`);
for (const f of called) console.log(`   ${f}  ${linesOf(f)} lines`);

// Root library files imported by an admin surface (the census counts lib/ops only).
const rootLib = walk("lib").filter((f) => /\.ts$/.test(f) && f.split("/").length === 2);
const imported = rootLib.filter((f) => {
  const frag = `@/lib/${f.replace("lib/", "").replace(/\.ts$/, "")}`;
  const exact = [`${frag}"`, `${frag}'`, `${frag}/`];
  return sources.some((s) => {
    const text = readFileSync(s, "utf8");
    return exact.some((needle) => text.includes(needle));
  });
});
console.log(`\nroot lib/*.ts total: ${rootLib.length}`);
console.log(`root lib files imported by an admin surface: ${imported.length}`);
for (const f of imported) console.log(`   ${f}  ${linesOf(f)} lines`);
