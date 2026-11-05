import postgres from 'postgres';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

for (const f of ['.env.local', '.env']) {
  const p = path.resolve(process.cwd(), f);
  if (fs.existsSync(p)) dotenv.config({ path: p });
}

const url = process.env.DIRECT_URL;
if (!url) { console.log('NO_DIRECT_URL'); process.exit(1); }

const ALERT_TYPES = [
  'anomaly_detected', 'identity_violation', 'scope_violation', 'quality_gate_failed', 'agent_task_failed',
  'system:anomaly_detected', 'system:error', 'tool:failed', 'workflow:failed', 'task:failed',
];

const sql = postgres(url, { ssl: 'require', max: 1 });
const out = [];
const log = (s) => { out.push(s); console.log(s); };

try {
  const cols = await sql`
    select column_name from information_schema.columns
    where table_name = 'ops_sync_events' order by ordinal_position`;
  if (!cols.length) { log('TABLE_ABSENT: ops_sync_events'); }
  else {
    log('LEDGER_COLUMNS=' + cols.length + ' | ' + cols.map(c => c.column_name).join(','));
    const total = await sql`select count(*)::int as n from ops_sync_events`;
    log('LEDGER_ROWS=' + total[0].n);
    const span = await sql`select min(created_at) as f, max(created_at) as l from ops_sync_events`;
    log('FIRST=' + span[0].f + ' LAST=' + span[0].l);
    const byType = await sql`select event_type, count(*)::int as n from ops_sync_events group by event_type order by n desc limit 25`;
    for (const r of byType) log('  type: ' + r.event_type + ' = ' + r.n);
    const alerts = await sql`
      select count(*)::int as n from ops_sync_events where event_type = any(${ALERT_TYPES})`;
    log('ALERT_TYPED_ROWS=' + alerts[0].n);
    const acks = await sql`
      select count(*)::int as n from ops_sync_events where event_type = 'owner_alert_acknowledged'`;
    log('ACK_ROWS=' + acks[0].n);
    const lastHour = await sql`
      select count(*)::int as n from ops_sync_events
      where event_type = any(${ALERT_TYPES}) and created_at > now() - interval '1 hour'`;
    log('ALERTS_LAST_HOUR=' + lastHour[0].n);
    const sample = await sql`
      select event_type, source_agent, created_at from ops_sync_events
      where event_type = any(${ALERT_TYPES}) order by created_at desc limit 5`;
    log('ALERT_SAMPLE=' + sample.length);
    for (const r of sample) log('  alert: ' + r.event_type + ' | ' + r.source_agent + ' | ' + new Date(r.created_at).toISOString());
  }

  // how many events per table shape — is agent_events read by anything alive?
  const orch = await sql`select count(*)::int as n from agent_events where created_at > now() - interval '74 days'`;
  log('AGENT_EVENTS_LAST_74_DAYS=' + orch[0].n);
} catch (e) {
  log('ERROR: ' + ((e && e.message) || String(e)));
} finally {
  await sql.end();
  fs.writeFileSync(path.resolve(process.cwd(), 'scratch/measure-alerts-ledger.out'), out.join('\n') + '\n');
}
