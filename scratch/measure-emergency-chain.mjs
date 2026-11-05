import postgres from 'postgres';
import fs from 'node:fs';
import dotenv from 'dotenv';
for (const f of ['.env.local', '.env']) { const p = process.cwd() + '/' + f; if (fs.existsSync(p)) dotenv.config({ path: p }); }
const sql = postgres(process.env.DIRECT_URL, { ssl: 'require', max: 1 });
const out = []; const log = (s) => { out.push(s); console.log(s); };
const TABLES = ['emergency_stop_state', 'agent_tasks', 'device_locks', 'approval_requests'];
try {
  for (const t of TABLES) {
    const exists = (await sql`select count(*)::int c from information_schema.tables where table_schema='public' and table_name=${t}`)[0].c;
    if (!exists) { log('TABLE_ABSENT: ' + t); continue; }
    const cols = await sql`select column_name, is_nullable, data_type from information_schema.columns where table_schema='public' and table_name=${t} order by ordinal_position`;
    const rows = (await sql.unsafe(`select count(*)::int c from ${t}`))[0].c;
    log('TABLE ' + t + ' | rows=' + rows + ' | cols=' + cols.map((c) => c.column_name + ':' + c.data_type).join(', '));
    const cons = await sql`select conname, pg_get_constraintdef(oid) d from pg_constraint where conrelid = ${t}::regclass`;
    for (const c of cons) if (/CHECK|UNIQUE/i.test(c.d)) log('   constraint ' + c.conname + ' :: ' + c.d);
  }
  const statuses = await sql`select status, count(*)::int c from agent_tasks group by status order by c desc`;
  log('AGENT_TASK_STATUSES: ' + statuses.map((s) => s.status + '=' + s.c).join(' · '));
  const activeStops = await sql`select count(*)::int c from emergency_stop_state where is_active = true`;
  log('ACTIVE_STOPS=' + activeStops[0].c);
  const locks = await sql`select count(*)::int c from device_locks where released_at is null`;
  log('OPEN_LOCKS=' + locks[0].c);
} catch (e) {
  log('ERROR: ' + String(e && e.message ? e.message : e).slice(0, 200));
} finally {
  await sql.end();
  fs.writeFileSync('scratch/measure-emergency-chain.out', out.join('\n') + '\n');
}
