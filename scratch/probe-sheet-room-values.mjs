import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
const rows = await db.$queryRawUnsafe(
  `select coalesce(room,'(null)') room, count(*)::int n,
          count(*) filter (where room ~ '[A-Za-z]')::int latin
   from public.room_sketches group by 1 order by 2 desc limit 30`
);
console.log(JSON.stringify(rows, (k, v) => (typeof v === "bigint" ? Number(v) : v)));
const total = await db.$queryRawUnsafe(`select count(*)::int n, count(*) filter (where room ~ '[A-Za-z]')::int latin from public.room_sketches`);
console.log("total:", JSON.stringify(total, (k, v) => (typeof v === "bigint" ? Number(v) : v)));
await db.$disconnect();
