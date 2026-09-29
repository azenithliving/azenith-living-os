/**
 * One domain, four sources, before anything moves.
 *
 * The owner's charge that built this: «you were supposed to gather everything that
 * has to do with one thing, merge it into one entity, and only then move it». The
 * inventory below answers what belongs to «customer» from the four places truth
 * actually lives — the running site, the code, the database, the platform — instead
 * of from the folder listing, which is where every surprise so far came from.
 *
 * Read-only. Prints counts and names.
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

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
const text = (f) => fs.readFileSync(f, "utf8");

// 1. The database: every live relation whose name or columns speak about customers.
const relations = await db.$queryRawUnsafe(
  `select c.relname::text as n, c.relkind::text as k from pg_class c
     where c.relnamespace='public'::regnamespace and c.relkind in ('r','v') order by c.relname`,
);
const CUSTOMER_WORDS = /lead|customer|consultant|request|booking|order|client|opportunit|crm|contact|whatsapp|session/;
const liveTables = relations.filter((r) => CUSTOMER_WORDS.test(r.n) && !r.n.startsWith("_p"));
console.log("=== the database says ===");
for (const t of liveTables) {
  let n = "?";
  try { n = (await db.$queryRawUnsafe(`select count(*)::int as n from "${t.n}"`))[0].n; } catch { n = "unreadable"; }
  console.log(`   ${t.n.padEnd(34)} kind=${t.k} rows=${n}`);
}
const promised = ["vanguard_leads", "vanguard_lead_activities", "vanguard_opportunities"];
const have = new Set(relations.map((r) => r.n));
console.log(`   tables the code writes to but the database does not have: ${promised.filter((t) => !have.has(t)).length}`);
for (const t of promised.filter((x) => !have.has(x))) console.log(`   MISSING  ${t}`);

// 2. The code: every file that names one of those ledgers.
const names = new Set([...liveTables.map((t) => t.n), ...promised]);
const files = sources.filter((f) => { const s = text(f); return [...names].some((n) => s.includes(`"${n}"`) || s.includes(`'${n}'`)); });
const byLayer = { "screens (admin pages)": 0, "customer pages": 0, "doors": 0, "machinery (lib)": 0, "parts (components)": 0 };
for (const f of files) {
  if (f.startsWith("app/api/")) byLayer.doors++;
  else if (f.startsWith("app/admin")) byLayer["screens (admin pages)"]++;
  else if (f.startsWith("app/")) byLayer["customer pages"]++;
  else if (f.startsWith("lib/")) byLayer["machinery (lib)"]++;
  else byLayer["parts (components)"]++;
}
console.log("\n=== the code says ===");
console.log(`   files touching a customer ledger: ${files.length}`);
for (const [k, v] of Object.entries(byLayer)) console.log(`      ${k.padEnd(24)} ${v}`);

// 3. The site: what the owner can actually press, from the live walk.
const screens = fs.existsSync("docs/ledger/screens.json") ? JSON.parse(text("docs/ledger/screens.json")).rows : [];
const customerRoutes = ["/admin/sales", "/admin/v2/sales", "/bookings", "/request", "/admin/work"];
const onSite = screens.filter((r) => customerRoutes.some((p) => r.route === p));
console.log("\n=== the running site says ===");
console.log(`   addresses measured: ${onSite.length}  controls: ${onSite.reduce((a, r) => a + (r.arabicControls || 0), 0)}  views inside them: ${onSite.reduce((a, r) => a + (r.detail || []).length, 0)}`);

// 4. The platform: doors that exist for this domain, and whether anything calls them.
const adminSurfaces = [...walk("app/admin"), ...walk("components/admin")].filter((f) => /\.tsx?$/.test(f)).map(text).join("\n");const doors = walk("app/api").filter((f) => f.endsWith("route.ts"));
const domainDoors = doors.filter((f) => { const s = text(f); return [...names].some((n) => s.includes(`"${n}"`) || s.includes(`'${n}'`)); });
const specOf = (f) => "/" + f.replace(/^app\//, "").replace(/\/route\.ts$/, "");
const orphan = domainDoors.filter((f) => !adminSurfaces.includes(specOf(f)));
console.log("\n=== the platform says ===");
console.log(`   doors reading or writing a customer ledger: ${domainDoors.length}`);
console.log(`   of them opened by no admin surface: ${orphan.length}`);
for (const f of orphan.slice(0, 10)) console.log(`      ${f}`);

await db.$disconnect();
