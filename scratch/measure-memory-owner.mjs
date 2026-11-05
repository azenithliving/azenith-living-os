import postgres from 'postgres';
import fs from 'node:fs';
import dotenv from 'dotenv';
for (const f of ['.env.local', '.env']) { const p = process.cwd() + '/' + f; if (fs.existsSync(p)) dotenv.config({ path: p }); }
const sql = postgres(process.env.DIRECT_URL, { ssl: 'require', max: 1 });
const out = []; const log = (s) => { out.push(s); console.log(s); };
try {
  const t = await sql`select count(*)::int as n from information_schema.tables where table_schema='public' and table_name='users'`;
  log('PUBLIC_USERS_TABLE=' + t[0].n);
  if (t[0].n === 1) {
    const cols = await sql`select column_name from information_schema.columns where table_schema='public' and table_name='users' order by ordinal_position`;
    log('users cols=' + cols.map((c) => c.column_name).join(','));
    const gate = process.env.ADMIN_GATE_EMAIL || '';
    const rows = await sql`select id, (email = ${gate}) as is_gate_user from public.users order by id limit 10`;
    log('users rows(sample)=' + rows.length);
    for (const r of rows) log('  ' + String(r.id).slice(0, 8) + ' gate=' + r.is_gate_user);
    const total = await sql`select count(*)::int as n from public.users`;
    log('users total=' + total[0].n);
  }
  const gate2 = process.env.ADMIN_GATE_EMAIL || '';
  const auth = await sql`select id, (email = ${gate2}) as is_gate_user from auth.users order by created_at`;
  log('AUTH_USERS=' + auth.length);
  for (const a of auth) log('  auth ' + String(a.id).slice(0, 8) + ' gate=' + a.is_gate_user);
  const mem = await sql`select user_id, count(*)::int as n from agent_memory group by user_id`;
  log('memory user_id groups=' + mem.length);
  for (const m of mem) log('  ' + (m.user_id ? String(m.user_id) : 'NULL') + ' x' + m.n);
} catch (e) { log('ERROR: ' + String(e && e.message ? e.message : e)); } finally { await sql.end(); fs.writeFileSync('scratch/measure-memory-owner.out', out.join('\n') + '\n'); }
