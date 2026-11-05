import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

/**
 * How much of what the owner reads in the swarm's chat is written in a language he does not read?
 *   node scratch/probe-manifest-rows.mjs
 *
 * Read-only. Three counts over `agent_messages`: the rows carrying the capability manifest's own
 * opening sentence, the rows carrying any Latin letter, and the rows carrying a Latin digit. The
 * text is never printed — only a sender, a date and a length, because a chat row can hold a
 * customer's phone number.
 */
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

const total = await db.$queryRaw`select count(*)::int n from public.agent_messages`;
const manifest = await db.$queryRaw`
  select sender_type, count(*)::int n, min(created_at)::date first, max(created_at)::date last
  from public.agent_messages
  where content like ${"%أقدر أنفّذ لك%"}
  group by sender_type order by n desc`;
const latinLetter = await db.$queryRaw`
  select sender_type, count(*)::int n from public.agent_messages
  where content ~ '[A-Za-z]' group by sender_type order by n desc`;
const latinDigit = await db.$queryRaw`
  select count(*)::int n from public.agent_messages where content ~ '[0-9]'`;

const fmt = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
console.log("messages in the table:", total[0].n);
console.log("carrying the manifest sentence:", manifest.map((r) => `${r.sender_type}:${r.n} (${fmt(r.first)}..${fmt(r.last)})`).join(" · ") || "none");
console.log("carrying any Latin letter:", latinLetter.map((r) => `${r.sender_type}:${r.n}`).join(" · ") || "none");
console.log("carrying a Latin digit:", latinDigit[0].n);

// The card preview is the newest agent line per conversation: how many of those are unreadable?
const previews = await db.$queryRaw`
  select count(*)::int total,
         count(*) filter (where content ~ '[A-Za-z]')::int with_latin,
         count(*) filter (where content like ${"%أقدر أنفّذ لك%"})::int manifest
  from (
    select content, row_number() over (partition by conversation_id order by created_at desc) rn
    from public.agent_messages where sender_type = 'agent'
  ) t where rn = 1`;
console.log(
  "newest agent line per conversation:",
  JSON.stringify({ total: previews[0].total, carryingLatin: previews[0].with_latin, carryingManifest: previews[0].manifest })
);
await db.$disconnect();
