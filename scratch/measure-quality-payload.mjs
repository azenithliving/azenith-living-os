import postgres from 'postgres';
import fs from 'node:fs';
import dotenv from 'dotenv';
for (const f of ['.env.local', '.env']) { const p = process.cwd() + '/' + f; if (fs.existsSync(p)) dotenv.config({ path: p }); }
const sql = postgres(process.env.DIRECT_URL, { ssl: 'require', max: 1 });
const out = []; const log = (s) => { out.push(s); console.log(s); };
try {
  const rows = await sql`select source_agent, payload from ops_sync_events where event_type='quality_gate_failed' order by created_at desc limit 3`;
  for (const r of rows) log('quality: ' + r.source_agent + ' | ' + JSON.stringify(r.payload).slice(0, 500));
} catch (e) { log('ERROR: ' + ((e && e.message) || String(e))); } finally { await sql.end(); fs.writeFileSync('scratch/measure-quality-payload.out', out.join('\n') + '\n'); }
