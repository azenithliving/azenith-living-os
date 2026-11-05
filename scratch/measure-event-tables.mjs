import postgres from 'postgres';
import fs from 'node:fs';
import dotenv from 'dotenv';
for (const f of ['.env.local', '.env']) { const p = process.cwd() + '/' + f; if (fs.existsSync(p)) dotenv.config({ path: p }); }
const sql = postgres(process.env.DIRECT_URL, { ssl: 'require', max: 1 });
const out = []; const log = (s) => { out.push(s); console.log(s); };
try {
  const t = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_name like '%events%'
    order by table_name`;
  log('EVENT_TABLES=' + t.length);
  for (const r of t) {
    const n = await sql.unsafe(`select count(*)::int c, max(created_at) m from "${r.table_name}"`);
    log('  ' + r.table_name + ' | rows=' + n[0].c + ' | last=' + (n[0].m ? new Date(n[0].m).toISOString().slice(0, 10) : 'none'));
  }
} catch (e) { log('ERROR: ' + String(e && e.message ? e.message : e).slice(0, 200)); } finally { await sql.end(); fs.writeFileSync('scratch/measure-event-tables.out', out.join('\n') + '\n'); }
