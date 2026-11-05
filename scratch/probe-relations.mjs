import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
const r = await db.$queryRawUnsafe(`select relkind, count(*)::bigint c from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind in ('r','v','m','p') group by relkind order by relkind`);
console.log(r.map((x) => `${x.relkind}=${x.c}`).join(' '));
const ops = await db.$queryRawUnsafe(`select count(*)::bigint c from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind in ('r','v','m','p') and c.relname like 'ops%'`);
console.log('ops* =', String(ops[0].c));
await db.$disconnect();
