/**
 * Read-only: how many customer systems does this store actually have?
 *
 * The owner's doubt that opened this: «vanguard has something to do with this job».
 * Measured here — the tables each one writes and whether any screen can reach them.
 * Prints counts and file paths only.
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const p = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

const TABLES = [
  "consultant_sessions", "requests", "users", "leads",
  "vanguard_leads", "vanguard_lead_activities", "vanguard_opportunities",
  "sales_orders", "bookings", "production_jobs",
];

const present = await p.$queryRawUnsafe(
  `select c.relname::text as n from pg_class c
     where c.relnamespace='public'::regnamespace and c.relkind in ('r','v')`,
);
const have = new Set(present.map((r) => r.n));

console.log("=== the customer ledgers, live ===");
for (const t of TABLES) {
  if (!have.has(t)) { console.log(`${t.padEnd(28)} MISSING from the database`); continue; }
  const [{ n }] = await p.$queryRawUnsafe(`select count(*)::int as n from "${t}"`);
  console.log(`${t.padEnd(28)} rows=${n}`);
}

const norm = (f) => f.split(path.sep).join("/");
const walk = (d, acc = []) => {
  if (!fs.existsSync(d)) return acc;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const full = path.join(d, e.name);
    if (e.isDirectory()) walk(full, acc);
    else acc.push(norm(full));
  }
  return acc;
};
const sources = [...walk("app"), ...walk("lib"), ...walk("components")].filter((f) => /\.tsx?$/.test(f));

console.log("\n=== who names each ledger in code ===");
for (const t of TABLES) {
  const files = sources.filter((f) => {
    const s = fs.readFileSync(f, "utf8");
    return s.includes(`"${t}"`) || s.includes(`'${t}'`);
  });
  console.log(`${t.padEnd(28)} ${files.length} file(s)`);
  for (const f of files.slice(0, 5)) console.log(`      ${f}`);
}

// Reachability: is the vanguard automation engine entered from any door or screen?
console.log("\n=== is the vanguard automation engine reachable? ===");
const entryNames = ["automation/actions/index", "automation/trigger_engine", "VanguardAgent", "vanguard/automation"];
for (const name of entryNames) {
  const base = name.replace(/\/index$/, "");
  const callers = sources.filter((f) => fs.readFileSync(f, "utf8").includes(base) && !f.includes("lib/vanguard/") && !f.includes("lib/agents/"));
  console.log(`${name.padEnd(30)} called from outside its own tree: ${callers.length}`);
  for (const c of callers.slice(0, 6)) console.log(`      ${c}`);
}

await p.$disconnect();
