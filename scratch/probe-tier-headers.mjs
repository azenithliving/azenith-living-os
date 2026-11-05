import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
const [row] = await db.$queryRaw`select token from public.room_sketches where token is not null order by id desc limit 1`;
const base = process.argv[2];
for (const [label, init] of [["GET votes", { method: "GET" }], ["POST votes", { method: "POST", body: "{}" }]]) {
  const res = await fetch(`${base}/api/passport/${row.token}/votes`, init).catch((e) => null);
  console.log(`${label}: status=${res?.status} limit=${res?.headers.get("x-ratelimit-limit") ?? "—"} remaining=${res?.headers.get("x-ratelimit-remaining") ?? "—"}`);
}
await db.$disconnect();
