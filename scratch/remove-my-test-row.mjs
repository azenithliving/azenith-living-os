import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

/**
 * Removes ONE row: the development artifact my own earlier instrument left in the table the cockpit
 * renders. The owner's word «امشى» was given for this row alone, after its id and content were read
 * to him.
 *
 * Guarded three ways: the id is fixed, the row must still contain the development address it was
 * reported with, and at most one row may be affected. Anything unexpected stops without deleting.
 */
const ID = "3a559f7b-8544-4faf-af71-441a7be3d3aa";
const MARKER = "localhost:3222";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

const before = await db.$queryRawUnsafe(
  `select id::text as id, sender_type, left(content, 120) as sample, created_at::text as made from public.agent_messages where id = $1::uuid`,
  ID
);

console.log("row before:", JSON.stringify(before));

if (before.length !== 1) {
  console.log("STOP: that id is not exactly one row — nothing was deleted.");
} else if (!String(before[0].sample ?? "").includes(MARKER)) {
  console.log(`STOP: the row no longer carries «${MARKER}» — nothing was deleted.`);
} else {
  const changed = await db.$executeRawUnsafe(`delete from public.agent_messages where id = $1::uuid`, ID);
  const after = await db.$queryRawUnsafe(
    `select count(*)::int as left from public.agent_messages where id = $1::uuid`,
    ID
  );
  const strays = await db.$queryRawUnsafe(
    `select count(*)::int as n from public.agent_messages where content ilike '%' || $1 || '%'`,
    MARKER
  );
  console.log("deleted rows:", changed, "| still present by id:", after[0].left, "| rows anywhere carrying the dev address:", strays[0].n);
}

await db.$disconnect();
