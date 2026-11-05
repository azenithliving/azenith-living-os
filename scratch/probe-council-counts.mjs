import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

const rows = await db.$queryRawUnsafe(`select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'`);
const names = rows.map((r) => r.table_name);
const counts = {};
for (const t of ['family_votes', 'room_sketches', 'consultant_sessions', 'consultant_learnings', 'sales_orders', 'curated_images']) {
  if (!names.includes(t)) { counts[t] = 'NO SUCH TABLE'; continue; }
  const n = await db.$queryRawUnsafe(`select count(*)::bigint as c from public."${t}"`);
  counts[t] = String(n[0].c);
}
console.log('public tables      ', names.length, '· ops_*', names.filter((n) => n.startsWith('ops_')).length);
for (const [k, v] of Object.entries(counts)) console.log(k.padEnd(18), v);
await db.$disconnect();
