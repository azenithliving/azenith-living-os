import postgres from 'postgres';
import fs from 'node:fs';
import dotenv from 'dotenv';
for (const f of ['.env.local', '.env']) { const p = process.cwd() + '/' + f; if (fs.existsSync(p)) dotenv.config({ path: p }); }
const sql = postgres(process.env.DIRECT_URL, { ssl: 'require', max: 1 });
const out = []; const log = (s) => { out.push(s); console.log(s); };
try {
  const configured = (process.env.ADMIN_COMPANY_ID || '').trim();
  log('ADMIN_COMPANY_ID_SET=' + (configured ? 'yes' : 'no'));
  log('ADMIN_COMPANY_ID_SHAPE=' + (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(configured) ? 'uuid' : 'not-uuid'));
  const rows = await sql`select id, name from companies`;
  log('COMPANY_ROWS=' + rows.length);
  const match = rows.find((r) => String(r.id) === configured);
  log('MATCHES_A_COMPANY_ROW=' + (match ? 'yes' : 'no'));
  if (match) log('MATCHED_NAME=' + match.name);
} catch (e) { log('ERROR: ' + ((e && e.message) || String(e))); } finally { await sql.end(); fs.writeFileSync('scratch/measure-admin-company.out', out.join('\n') + '\n'); }
