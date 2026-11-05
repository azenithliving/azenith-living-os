import postgres from 'postgres';
import fs from 'node:fs';
import dotenv from 'dotenv';
for (const f of ['.env.local', '.env']) { const p = process.cwd() + '/' + f; if (fs.existsSync(p)) dotenv.config({ path: p }); }
const sql = postgres(process.env.DIRECT_URL, { ssl: 'require', max: 1 });
const out = []; const log = (s) => { out.push(s); console.log(s); };
try {
  const cons = await sql`select conname, pg_get_constraintdef(oid) as def from pg_constraint where conrelid = 'ops_sync_events'::regclass`;
  log('CONSTRAINTS=' + cons.length);
  for (const c of cons) log('  ' + c.conname + ' :: ' + c.def);
  const def = await sql`select column_name, column_default, is_nullable from information_schema.columns where table_name='ops_sync_events' order by ordinal_position`;
  for (const d of def) log('  col ' + d.column_name + ' default=' + (d.column_default ?? 'none') + ' null=' + d.is_nullable);
} catch (e) { log('ERROR: ' + String(e && e.message ? e.message : e)); } finally { await sql.end(); fs.writeFileSync('scratch/measure-ledger-constraints.out', out.join('\n') + '\n'); }
