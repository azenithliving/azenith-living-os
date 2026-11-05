import postgres from 'postgres';
import fs from 'node:fs';
import dotenv from 'dotenv';
for (const f of ['.env.local', '.env']) { const p = process.cwd() + '/' + f; if (fs.existsSync(p)) dotenv.config({ path: p }); }
const sql = postgres(process.env.DIRECT_URL, { ssl: 'require', max: 1 });
const out = []; const log = (s) => { out.push(s); console.log(s); };
try {
  const byType = await sql`
    select action_type, risk_level, count(*)::int c, min(created_at) first, max(created_at) last
    from approval_requests where company_id is null and status = 'pending'
    group by action_type, risk_level order by c desc`;
  log('ORPHAN_GROUPS=' + byType.length);
  for (const r of byType) log('  ' + r.action_type + ' | risk=' + r.risk_level + ' = ' + r.c + ' | ' + new Date(r.first).toISOString().slice(0,10) + ' .. ' + new Date(r.last).toISOString().slice(0,10));
  const cols = await sql`
    select count(*) filter (where actor_user_id is not null)::int with_actor,
           count(*) filter (where command_log_id is not null)::int with_command,
           count(*) filter (where metadata is not null and metadata::text <> '{}'::text)::int with_meta,
           count(*)::int total
    from approval_requests where company_id is null and status = 'pending'`;
  log('ORPHAN_SHAPE: total=' + cols[0].total + ' with_actor=' + cols[0].with_actor + ' with_command=' + cols[0].with_command + ' with_meta=' + cols[0].with_meta);
  const sample = await sql`
    select id, action_type, description, created_at, metadata from approval_requests
    where company_id is null and status = 'pending' order by created_at desc limit 4`;
  for (const s of sample) log('  sample: ' + s.action_type + ' | ' + String(s.description).slice(0, 70) + ' | ' + new Date(s.created_at).toISOString().slice(0,16) + ' | ' + JSON.stringify(s.metadata).slice(0, 120));
  const decided = await sql`
    select status, count(*)::int c from approval_requests where company_id is null group by status order by c desc`;
  log('ALL_NULL_BY_STATUS: ' + decided.map(r => r.status + '=' + r.c).join(' · '));
} catch (e) { log('ERROR: ' + String(e && e.message ? e.message : e).slice(0, 200)); } finally { await sql.end(); fs.writeFileSync('scratch/measure-orphan-papers.out', out.join('\n') + '\n'); }
