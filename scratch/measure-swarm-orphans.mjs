/**
 * The two orphan swarm screens: what would they show if their doors existed?
 * Read-only. Counts and column names only — no values printed.
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

const tables = await db.$queryRawUnsafe(
  `select table_name from information_schema.tables
     where table_schema='public' and table_name in ('agent_tasks','agent_profiles','agent_handoffs','agent_messages','ops_swarm_events')`,
);
console.log("existing swarm tables:", tables.map((t) => t.table_name).join(", "));

const exists = (n) => tables.some((t) => t.table_name === n);

if (exists("agent_handoffs")) {
  const cols = await db.$queryRawUnsafe(
    `select column_name, data_type from information_schema.columns
       where table_schema='public' and table_name='agent_handoffs' order by ordinal_position`,
  );
  console.log("agent_handoffs columns:", cols.map((c) => c.column_name).join(", "));
  const rows = await db.$queryRawUnsafe(`select count(*)::int as n from public.agent_handoffs`);
  console.log("agent_handoffs rows:", rows[0].n);
} else {
  console.log("agent_handoffs: TABLE MISSING");
}

if (exists("agent_tasks")) {
  const cols = await db.$queryRawUnsafe(
    `select column_name from information_schema.columns
       where table_schema='public' and table_name='agent_tasks' order by ordinal_position`,
  );
  console.log("agent_tasks columns:", cols.map((c) => c.column_name).join(", "));
  const per = await db.$queryRawUnsafe(`
    select p.agent_key,
           count(*)::int as total,
           count(*) filter (where t.status='completed')::int as done,
           count(*) filter (where t.status='failed')::int as failed,
           count(*) filter (where t.status in ('pending','running'))::int as open,
           round(coalesce(avg(t.actual_duration_minutes),0)::numeric,1)::float as avg_min
      from public.agent_tasks t
      left join public.agent_profiles p on p.id = t.agent_profile_id
     group by p.agent_key order by total desc`);
  console.table(per);
}

// Is there ANY real source for a 1-5 customer satisfaction score?
const ratingCols = await db.$queryRawUnsafe(`
  select table_name, column_name from information_schema.columns
   where table_schema='public'
     and (column_name ilike '%rating%' or column_name ilike '%satisfaction%'
          or column_name ilike '%csat%' or column_name ilike '%stars%')
   order by table_name`);
console.log("columns that could carry a satisfaction score:", JSON.stringify(ratingCols));

const sev = await db.$queryRawUnsafe(`
  select count(*)::int as n from public.users`);
console.log("users rows:", sev[0].n);
await db.$disconnect();
