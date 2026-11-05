import postgres from 'postgres';
import fs from 'node:fs';
import dotenv from 'dotenv';
for (const f of ['.env.local', '.env']) { const p = process.cwd() + '/' + f; if (fs.existsSync(p)) dotenv.config({ path: p }); }
const sql = postgres(process.env.DIRECT_URL, { ssl: 'require', max: 1 });
const out = []; const log = (s) => { out.push(s); console.log(s); };
try {
  const keys = await sql`select agent_key, count(*)::int c from agent_profiles group by agent_key order by c desc`;
  log('PROFILE_KEYS=' + keys.length); for (const k of keys) log('  ' + k.agent_key + ' = ' + k.c);
  const exists = await sql`select count(*)::int c from information_schema.tables where table_schema='public' and table_name='agent_devices'`;
  log('agent_devices_table=' + exists[0].c);
  if (exists[0].c) {
    const d = await sql`select count(*)::int c, count(*) filter (where is_active = true)::int active from agent_devices`;
    log('  devices rows=' + d[0].c + ' active=' + d[0].active);
  }
  const tasksByProfile = await sql`
    select p.agent_key, count(t.id)::int c
    from agent_profiles p left join agent_tasks t on t.agent_profile_id = p.id
    group by p.agent_key order by c desc`;
  log('TASKS_BY_KEY: ' + tasksByProfile.map(r => r.agent_key + '=' + r.c).join(' · '));
  const overdue = await sql`select count(*)::int c from approval_requests where status='pending' and requested_at < now() - interval '24 hours'`;
  log('OVERDUE_PAPERS_24H=' + overdue[0].c);
  const alertsToday = await sql`
    select count(*)::int c from ops_sync_events
    where created_at >= date_trunc('day', now())
      and event_type in ('anomaly_detected','identity_violation','scope_violation','quality_gate_failed','agent_task_failed','emergency_stop','system:anomaly_detected','system:error','tool:failed','workflow:failed','task:failed')`;
  log('ALERTS_TODAY=' + alertsToday[0].c);
} catch (e) { log('ERROR: ' + String(e && e.message ? e.message : e).slice(0, 200)); } finally { await sql.end(); fs.writeFileSync('scratch/measure-owner-dashboard-truth.out', out.join('\n') + '\n'); }
