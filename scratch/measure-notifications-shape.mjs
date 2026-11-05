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
const MARK = 'probe-alerts-shape-never-keep';

async function probe(label, run) {
  try {
    await sql.begin(async (tx) => {
      await run(tx);
      throw new Error('__ROLLED_BACK__');
    });
    return label + '=ACCEPTED';
  } catch (e) {
    const m = String((e && e.message) || e);
    if (m.includes('__ROLLED_BACK__')) return label + '=ACCEPTED_then_rolled_back';
    return label + '=REJECTED | ' + ((e && e.code) || '?') + ' | ' + m.slice(0, 100);
  }
}

try {
  const rows = await sql`select id, event_type, created_at, event_data from agent_events order by created_at desc`;
  log('ROWS=' + rows.length);
  for (const r of rows) log('  row: ' + r.event_type + ' | ' + r.created_at.toISOString() + ' | ' + JSON.stringify(r.event_data).slice(0, 120));

  const companies = await sql`select id, name, domain from companies order by name`;
  log('COMPANY_ROWS=' + companies.length);
  for (const c of companies) log('  company: ' + c.name + ' | ' + c.domain);
  const companyId = companies.length ? companies[0].id : null;

  if (!companyId) log('SKIP_INSERT_PROBES: no company row');
  else {
    for (const col of ['severity', 'acknowledged_at', 'message', 'metadata', 'acknowledged']) {
      log(await probe('INSERT_WITH_' + col, (tx) =>
        tx.unsafe(`insert into agent_events (company_id, event_type, "${col}") values ($1, $2, 'x')`, [companyId, MARK])));
    }
  }

  log(await probe('MARK_READ_PATCH', (tx) =>
    tx.unsafe(`update agent_events set acknowledged_at = now() where event_type = $1`, [MARK])));
  log(await probe('DASHBOARD_UNREAD_FILTER', (tx) =>
    tx.unsafe(`select * from agent_events where acknowledged = false`)));
  log(await probe('DASHBOARD_SEVERITY_FILTER', (tx) =>
    tx.unsafe(`select * from agent_events where severity = any ($1)`, [['warning', 'critical']])));

  const residue = await sql`select count(*)::int as n from agent_events where event_type = ${MARK}`;
  log('MY_ROWS_LEFT=' + residue[0].n);
  const totalAfter = await sql`select count(*)::int as n from agent_events`;
  log('ROWS_AFTER=' + totalAfter[0].n);
} catch (e) {
  log('ERROR: ' + ((e && e.message) || String(e)));
} finally {
  await sql.end();
  fs.writeFileSync(path.resolve(process.cwd(), 'scratch/measure-notifications-shape.out'), out.join('\n') + '\n');
}
