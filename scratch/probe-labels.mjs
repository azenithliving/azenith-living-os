import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
const rows = await db.$queryRaw`select id, dimensions from public.room_sketches where jsonb_array_length(dimensions) > 0 order by id`;
for (const r of rows) {
  const dims = typeof r.dimensions === 'string' ? JSON.parse(r.dimensions) : r.dimensions;
  console.log(String(r.id), JSON.stringify(dims.map((d) => `${d.label}=${d.meters}${d.confirmed ? "*" : ""}`)));
}
await db.$disconnect();
