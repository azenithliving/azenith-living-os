import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
const rows = await db.$queryRaw`select id, dimensions, area_sqm, plan from public.room_sketches where plan is not null order by id desc limit 3`;
for (const r of rows) {
  const dims = typeof r.dimensions === "string" ? JSON.parse(r.dimensions) : r.dimensions;
  const plan = typeof r.plan === "string" ? JSON.parse(r.plan) : r.plan;
  console.log(`paper ${r.id}: dims=${JSON.stringify(dims.map((d) => `${d.meters}${d.confirmed ? "*" : ""}`))} area_sqm=${String(r.area_sqm)} planWalls=${JSON.stringify(plan?.walls?.map((w) => w.meters))} planArea=${String(plan?.areaSqm)} sidesOnPaper=${plan?.sidesOnPaper}`);
}
await db.$disconnect();
