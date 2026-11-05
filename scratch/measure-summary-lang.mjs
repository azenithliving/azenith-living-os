import postgres from 'postgres';
import fs from 'node:fs';
import dotenv from 'dotenv';
for (const f of ['.env.local', '.env']) { const p = process.cwd() + '/' + f; if (fs.existsSync(p)) dotenv.config({ path: p }); }
const sql = postgres(process.env.DIRECT_URL, { ssl: 'require', max: 1 });
const out = []; const log = (s) => { out.push(s); console.log(s); };
const ALERT_TYPES = ['anomaly_detected','identity_violation','scope_violation','quality_gate_failed','agent_task_failed','system:anomaly_detected','system:error','tool:failed','workflow:failed','task:failed'];
try {
  const rows = await sql`select event_type, source_agent, created_at, payload->>'summary' as summary from ops_sync_events where event_type = any(${ALERT_TYPES}::text[]) and payload ? 'summary' order by created_at desc limit 10`;
  log('SUMMARY_ROWS=' + rows.length);
  for (const r of rows) { const hasAr = /[؀-ۿ]/.test(r.summary ?? ''); const hasLatin = /[A-Za-z]/.test(r.summary ?? ''); log('  ' + r.event_type + ' | ' + r.source_agent + ' | arabic=' + hasAr + ' latin=' + hasLatin + ' | ' + String(r.summary).slice(0, 130)); }
} catch (e) { log('ERROR: ' + ((e && e.message) || String(e))); } finally { await sql.end(); fs.writeFileSync('scratch/measure-summary-lang.out', out.join('\n') + '\n'); }
