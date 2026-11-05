import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
const r = await db.$queryRawUnsafe(`select style, count(*)::bigint c from public.curated_images where is_active group by style order by c desc`);
console.log('style: ' + r.map((x) => `${x.style ?? 'NULL'}=${String(x.c)}`).join(' · '));
const q = await db.$queryRawUnsafe(`select min(quality_score)::text lo, max(quality_score)::text hi, count(distinct quality_score)::bigint steps from public.curated_images where is_active`);
console.log('quality: ' + JSON.stringify(q));
await db.$disconnect();
