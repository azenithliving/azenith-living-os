// Read-only: who writes each ledger the sales employee runs on?
// The frozen contract names owners for ops_* tables only; this measures the rest.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const norm = (p) => p.split("\\").join("/");
const walk = (dir, acc = []) => {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return acc;
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(norm(p));
  }
  return acc;
};

const sources = [...walk("app"), ...walk("lib"), ...walk("components")].filter((f) => /\.tsx?$/.test(f));
const ledgers = [
  "consultant_sessions",
  "consultant_pending_questions",
  "consultant_learnings",
  "site_settings",
  "users",
  "requests",
  "companies",
  "visitor_telemetry",
];

const WRITE = /\.(insert|upsert|update|delete)\s*\(/;

for (const table of ledgers) {
  const writers = new Set();
  const readers = new Set();
  for (const f of sources) {
    const text = readFileSync(f, "utf8");
    for (const quote of [`"${table}"`, `'${table}'`]) {
      let at = text.indexOf(quote);
      while (at !== -1) {
        const before = text.slice(Math.max(0, at - 12), at);
        if (before.includes(".from(")) {
          const after = text.slice(at, at + 260);
          (WRITE.test(after) ? writers : readers).add(f);
        }
        at = text.indexOf(quote, at + quote.length);
      }
    }
  }
  const readsOnly = [...readers].filter((r) => !writers.has(r)).length;
  console.log(`${table.padEnd(30)} writes=${writers.size}  readsOnly=${readsOnly}`);
  for (const w of [...writers].slice(0, 6)) console.log(`      W ${w}`);
}
