import postgres from 'postgres';
import fs from 'node:fs';
import dotenv from 'dotenv';
for (const f of ['.env.local', '.env']) { const p = process.cwd() + '/' + f; if (fs.existsSync(p)) dotenv.config({ path: p }); }
const sql = postgres(process.env.DIRECT_URL, { ssl: 'require', max: 1 });
const out = []; const log = (s) => { out.push(s); console.log(s); };
try {
  const r = await sql`
    select status, count(*)::int c,
           count(scheduled_at)::int with_schedule,
           count(*) filter (where status in ('pending','running','queued') and scheduled_at is not null and scheduled_at < now())::int overdue
    from agent_tasks group by status order by c desc`;
  for (const x of r) log('  ' + x.status + ' | rows=' + x.c + ' | with_schedule=' + x.with_schedule + ' | overdue=' + x.overdue);
  const alertsToday = await sql`
    select count(*)::int c from ops_sync_events
    where event_type in ('anomaly_detected','identity_violation','scope_violation','quality_gate_failed','agent_task_failed','system:anomaly_detected','system:error','tool:failed','workflow:failed','task:failed','emergency_stop')
      and created_at >= date_trunc('day', now())`;
  log('ALERT_TODAY=' + alertsToday[0].c);
} catch (e) { log('ERROR: ' + String(e && e.message ? e.message : e).slice(0, 200)); } finally { await sql.end(); fs.writeFileSync('scratch/measure-task-dates.out', out.join('\n') + '\n'); }
