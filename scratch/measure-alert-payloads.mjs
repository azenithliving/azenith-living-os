import postgres from 'postgres';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
for (const f of ['.env.local', '.env']) { const p = path.resolve(process.cwd(), f); if (fs.existsSync(p)) dotenv.config({ path: p }); }
const sql = postgres(process.env.DIRECT_URL, { ssl: 'require', max: 1 });
const ALERT_TYPES = ['anomaly_detected','identity_violation','scope_violation','quality_gate_failed','agent_task_failed','system:anomaly_detected','system:error','tool:failed','workflow:failed','task:failed'];
const out = []; const log = (s) => { out.push(s); console.log(s); };
try {
  const dt = await sql`select column_name, data_type from information_schema.columns where table_name='ops_sync_events' order by ordinal_position`;
  for (const c of dt) log('col: ' + c.column_name + ' | ' + c.data_type);
  const rows = await sql`select event_type, payload from ops_sync_events where event_type = any(${ALERT_TYPES}::text[])`;
  log('ALERT_ROWS=' + rows.length);
  const keys = new Map();
  for (const r of rows) { const p = r.payload && typeof r.payload === 'object' ? r.payload : {}; const k = Object.keys(p).sort().join(','); keys.set(k, (keys.get(k) ?? 0) + 1); }
  for (const [k, n] of [...keys.entries()].sort((a,b)=>b[1]-a[1])) log('  keyset [' + k + '] = ' + n);
  const samples = await sql`select event_type, payload from ops_sync_events where event_type = any(${ALERT_TYPES}::text[]) order by created_at desc limit 6`;
  for (const s of samples) log('  sample: ' + s.event_type + ' | ' + JSON.stringify(s.payload).slice(0, 220));
  const ackPayload = await sql`select payload from ops_sync_events where event_type='owner_alert_acknowledged' order by created_at desc limit 3`;
  for (const a of ackPayload) log('  ack: ' + JSON.stringify(a.payload));
} catch (e) { log('ERROR: ' + ((e && e.message) || String(e))); } finally { await sql.end(); fs.writeFileSync('scratch/measure-alert-payloads.out', out.join('\n') + '\n'); }
