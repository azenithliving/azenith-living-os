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

const sql = postgres(url, { ssl: 'require', max: 1 });
const out = [];
const log = (s) => { out.push(s); console.log(s); };

try {
  const cols = await sql`
    select column_name, data_type, is_nullable, column_default
    from information_schema.columns
    where table_name = 'agent_events'
    order by ordinal_position`;
  if (!cols.length) log('TABLE_ABSENT: agent_events');
  else {
  log('COLUMNS=' + cols.length);
  for (const c of cols) log('  col: ' + c.column_name + ' | ' + c.data_type + ' | null=' + c.is_nullable);

  const total = await sql`select count(*)::int as n from agent_events`;
  log('ROWS=' + total[0].n);

  const byType = await sql`
    select event_type, count(*)::int as n
    from agent_events group by event_type order by n desc`;
  log('BY_EVENT_TYPE=' + byType.length);
  for (const r of byType) log('  type: ' + r.event_type + ' = ' + r.n);

  const unack = await sql`select count(*)::int as n from agent_events where acknowledged_at is null`;
  log('UNACKNOWLEDGED=' + unack[0].n);

  const sev = await sql`
    select severity, count(*)::int as n from agent_events group by severity order by n desc`;
  for (const r of sev) log('  severity: ' + r.severity + ' = ' + r.n);

  const span = await sql`
    select min(created_at) as first_at, max(created_at) as last_at
    from agent_events`;
  log('FIRST=' + span[0].first_at + '  LAST=' + span[0].last_at);

  const last7 = await sql`
    select count(*)::int as n from agent_events
    where created_at > now() - interval '7 days'`;
  log('ROWS_LAST_7_DAYS=' + last7[0].n);

  const sample = await sql`
    select id, event_type, severity, created_at, event_data
    from agent_events order by created_at desc limit 5`;
  log('SAMPLE=' + sample.length);
  for (const r of sample) log('  row: ' + r.event_type + ' | ' + r.severity + ' | ' + r.created_at.toISOString() + ' | ' + JSON.stringify(r.event_data).slice(0, 160));

  const companyIds = await sql`
    select company_id, count(*)::int as n from agent_events group by company_id`;
  for (const r of companyIds) log('  company: ' + r.company_id + ' = ' + r.n);
  }
} catch (e) {
  log('ERROR: ' + (e && e.message ? e.message : String(e)));
} finally {
  await sql.end();
  fs.writeFileSync(path.resolve(process.cwd(), 'scratch/measure-notifications-table.out'), out.join('\n') + '\n');
}
