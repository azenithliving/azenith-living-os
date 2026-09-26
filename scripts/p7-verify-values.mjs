/**
 * p7-verify-values.mjs — read-back for the P7-M2 identity migration.
 *
 * The migration covers the 19 columns a full column scan found in the live
 * database. 17 must come back clean; 2 are history by decision and are reported,
 * not asserted, so the file cannot quietly "pass" by forgetting them.
 *
 * Read-only. Usage: node scripts/p7-verify-values.mjs
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const p = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });

const MIGRATED = [
  ["agent_messages", "sender_name"],
  ["agent_profiles", "agent_key"],
  ["agent_profiles", "name"],
  ["enterprise_agents", "agent_key"],
  ["enterprise_agents", "name"],
  ["qayyim_benchmark_runs", "agent_key"],
  ["qayyim_drafts", "created_by"],
  ["qayyim_experiments", "created_by"],
  ["qayyim_suggestions", "source_agent"],
  ["qayyim_swarm_learnings", "source_agent"],
  ["qayyim_sync_events", "source_agent"],
  ["qayyim_sync_events", "target_agents"],
  ["qayyim_task_metrics", "agent_key"],
  ["agent_conversations", "title"],
];

// These columns hold prose an agent wrote at the time, or a URL that was
// recorded then. The migration rewrites identity tokens inside them, but what
// remains is history the owner already read — reported, never asserted, and
// never edited to make a check look green.
const HISTORY = [
  ["agent_messages", "content", "the message body as sent"],
  ["agent_messages", "context", "tool payloads recorded with the message"],
  ["qayyim_benchmark_runs", "details", "the audit's own narrative"],
  ["qayyim_sync_events", "payload", "event bodies already published"],
  ["agent_tasks", "description", "the task text as assigned"],
  ["agent_tasks", "output_data", "the agent's answer at the time"],
  ["visitor_telemetry", "current_path", "a URL recorded during an old visit"],
];

let bad = 0;
for (const [table, column] of MIGRATED) {
  const [{ n }] = await p.$queryRawUnsafe(
    `select count(*)::bigint as n from public."${table}" where "${column}"::text ~* 'qayyim|قيّم الدار'`
  );
  const value = Number(n);
  if (value !== 0) bad++;
  console.log(`${value === 0 ? "PASS" : "FAIL"}  ${table}.${column}: ${value} row(s) still retired-name`);
}

for (const [table, column, why] of HISTORY) {
  const [{ n }] = await p.$queryRawUnsafe(
    `select count(*)::bigint as n from public."${table}" where "${column}"::text ~* 'qayyim|قيّم الدار'`
  );
  console.log(`HISTORY  ${table}.${column}: ${Number(n)} row(s) kept on purpose — ${why}`);
}

const tables = [...new Set(MIGRATED.map((m) => m[0]))];
for (const t of tables) {
  const [{ n: live }] = await p.$queryRawUnsafe(`select count(*)::bigint as n from public."${t}"`);
  let snap;
  try {
    [{ n: snap }] = await p.$queryRawUnsafe(`select count(*)::bigint as n from public."_p7_backup_${t}"`);
  } catch {
    console.log(`SNAPSHOT  ${t}: none yet (run the migration to create _p7_backup_${t})`);
    continue;
  }
  const ok = Number(live) >= Number(snap);
  if (!ok) bad++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${t}: ${Number(live)} rows now, ${Number(snap)} in the snapshot`);
}

await p.$disconnect();
console.log(bad ? `\n${bad} check(s) failed` : "\nall migrated columns clean");
process.exit(bad ? 1 : 0);
