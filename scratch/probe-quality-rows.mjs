import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
const rows = await db.$queryRaw`select status, check_type, count(*)::int n from public.quality_checks group by status, check_type order by status`;
console.log("table truth:", JSON.stringify(rows.map((r) => `${r.status}/${r.check_type}×${r.n}`)));
const total = rows.reduce((s, r) => s + r.n, 0);
const pass = rows.filter((r) => r.status === "pass").reduce((s, r) => s + r.n, 0);
console.log(`total=${total} pass=${pass} rate=${Math.round((pass / total) * 100)}%`);
await db.$disconnect();
