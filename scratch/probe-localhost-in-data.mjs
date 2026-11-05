import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

/**
 * Where did a development address get into what the published cockpit renders?
 * Scans text and jsonb columns of the tables the cockpit reads for the string. Read-only.
 */
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

const targets = [
  ["agent_messages", "content"],
  ["agent_messages", "context"],
  ["site_settings", "value"],
  ["ops_canvas_cards", "payload"],
  ["ops_sync_events", "payload"],
  ["room_sketches", "image_path"],
  ["events", "properties"],
];

for (const [table, column] of targets) {
  try {
    const rows = await db.$queryRawUnsafe(
      `select id::text as id, left(${column}::text, 160) as sample from public.${table} where ${column}::text ilike '%localhost%' limit 3`
    );
    console.log(`${table}.${column}: ${rows.length ? JSON.stringify(rows) : "clean"}`);
  } catch (e) {
    console.log(`${table}.${column}: unreadable (${String(e.message).slice(0, 60)})`);
  }
}

await db.$disconnect();
