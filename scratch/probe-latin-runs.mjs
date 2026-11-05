import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

/**
 * WHY is every newest agent line unreadable to a man who reads Arabic?
 *   node scratch/probe-latin-runs.mjs
 *
 * Read-only. For the newest agent line in each conversation it prints the shape of the text
 * (Arabic share, Latin share, where the Latin sits) and the distinct Latin runs, with anything
 * that looks like a number, an address or an e-mail masked out — a chat row can carry a
 * customer's phone, and this prints none of it.
 */
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

const rows = await db.$queryRaw`
  select conversation_id, sender_type, content, created_at
  from (
    select conversation_id, sender_type, content, created_at,
           row_number() over (partition by conversation_id order by created_at desc) rn
    from public.agent_messages
  ) t where rn = 1 and sender_type = 'agent'`;

const mask = (run) => (/[0-9@]|.{25,}/.test(run) ? "«مقنّع»" : run);

for (const r of rows) {
  const text = String(r.content ?? "");
  const arabic = (text.match(/\p{Script=Arabic}/gu) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  const runs = [...new Set((text.match(/[A-Za-z][A-Za-z_./+-]{1,}/g) ?? []))];
  const firstIsArabic = /^\s*\p{Script=Arabic}/u.test(text);
  console.log(
    `conv ${String(r.conversation_id).slice(0, 8)} · ${new Date(r.created_at).toISOString().slice(0, 10)} · ` +
      `len ${text.length} · arabic ${arabic} · latin ${latin} · startsArabic ${firstIsArabic} · ` +
      `lines ${text.split("\n").length}`
  );
  console.log(`   runs: ${runs.slice(0, 14).map(mask).join(" ") || "none"}`);
}
await db.$disconnect();
