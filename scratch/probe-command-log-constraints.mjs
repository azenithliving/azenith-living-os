import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

/**
 * What does the command log's own check constraint actually demand?
 * Reads the constraint text from the catalog — nothing is written.
 */
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

const constraints = await db.$queryRawUnsafe(
  "select conname, contype, pg_get_constraintdef(oid) as def from pg_constraint where conrelid = 'public.immutable_command_log'::regclass order by conname"
);
for (const c of constraints) console.log(`${c.conname} [${c.contype}] → ${c.def}`);

const triggers = await db.$queryRawUnsafe(
  "select tgname, pg_get_triggerdef(oid) as def from pg_trigger where tgrelid = 'public.immutable_command_log'::regclass and not tgisinternal"
);
for (const t of triggers) console.log(`trigger ${t.tgname} → ${t.def}`);

await db.$disconnect();
