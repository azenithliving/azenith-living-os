import postgres from 'postgres';
import fs from 'node:fs';
import dotenv from 'dotenv';
for (const f of ['.env.local', '.env']) { const p = process.cwd() + '/' + f; if (fs.existsSync(p)) dotenv.config({ path: p }); }
const sql = postgres(process.env.DIRECT_URL, { ssl: 'require', max: 1 });
const out = []; const log = (s) => { out.push(s); console.log(s); };
const MARKS = ['سطر قياس شكله واحد', 'سطر قياس شكله اتنين', 'سطر قياس شكله تلاتة'];
const COMPANY = process.env.ADMIN_COMPANY_ID?.trim();
const ids = [];
try {
  const forms = [
    { label: 'json-string-cast', value: JSON.stringify({ summary: MARKS[0] }), cast: true },
    { label: 'object-cast', value: { summary: MARKS[1] }, cast: true },
    { label: 'object-nocast', value: { summary: MARKS[2] }, cast: false },
  ];
  for (const f of forms) {
    const q = f.cast
      ? sql`insert into ops_sync_events (company_id, event_type, source_agent, target_agents, payload)
            values (${COMPANY}, 'tool:failed', 'ops-qa', '[]', ${f.value}::jsonb) returning id, jsonb_typeof(payload) as t, payload->>'summary' as s`
      : sql`insert into ops_sync_events (company_id, event_type, source_agent, target_agents, payload)
            values (${COMPANY}, 'tool:failed', 'ops-qa', '[]', ${f.value}) returning id, jsonb_typeof(payload) as t, payload->>'summary' as s`;
    const [r] = await q;
    ids.push(r.id);
    log('FORM=' + f.label + ' | id=' + r.id + ' | typeof=' + r.t + ' | summary=' + JSON.stringify(r.s));
  }
} catch (e) {
  log('ERROR: ' + String(e && e.stack ? e.stack : e).slice(0, 300));
} finally {
  for (const id of ids) await sql`delete from ops_sync_events where id = ${id}`;
  const [res] = await sql`select count(*)::int c from ops_sync_events where payload->>'summary' like 'سطر قياس شكله%'`;
  log('RESIDUE=' + res.c);
  log('DELETED_IDS=' + ids.join(','));
  await sql.end();
  fs.writeFileSync('scratch/probe-payload-shape.out', out.join('\n') + '\n');
}
