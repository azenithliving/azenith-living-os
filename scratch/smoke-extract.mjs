import { readFileSync } from "node:fs";

const routeSource = readFileSync("app/api/admin/intel/relations/health/route.ts", "utf8");
const memorySource = readFileSync("lib/ops/memory-record.ts", "utf8");

const memoryListLiteral = memorySource.match(/MEMORY_WRITE_COLUMNS\s*=\s*\[([\s\S]*?)\]/);
const memoryRequired = memoryListLiteral
  ? [...memoryListLiteral[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1])
  : [];

const required = [];
for (const m of routeSource.matchAll(/\{\s*table:\s*"([a-z_]+)",\s*columns:\s*\[([\s\S]*?)\]\s*\}/g)) {
  const table = m[1];
  const columns = m[2].includes("MEMORY_WRITE_COLUMNS")
    ? memoryRequired
    : [...m[2].matchAll(/"([a-z_]+)"/g)].map((x) => x[1]);
  required.push({ table, columns });
}

console.log("memoryRequired=" + memoryRequired.length + " -> " + memoryRequired.join(","));
console.log("required lists=" + required.length);
for (const r of required) console.log("  " + r.table + " (" + r.columns.length + ") -> " + r.columns.join(","));
