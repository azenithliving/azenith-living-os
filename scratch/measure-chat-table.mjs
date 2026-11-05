import postgres from 'postgres';
import fs from 'node:fs';
import dotenv from 'dotenv';
for (const f of ['.env.local', '.env']) { const p = process.cwd() + '/' + f; if (fs.existsSync(p)) dotenv.config({ path: p }); }
const sql = postgres(process.env.DIRECT_URL, { ssl: 'require', max: 1 });
const out = []; const log = (s) => { out.push(s); console.log(s); };

async function shape(table) {
  const cols = await sql`select column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' and table_name=${table} order by ordinal_position`;
  log('== ' + table + ' columns=' + cols.length);
  for (const c of cols) log('   ' + c.column_name + ' :: ' + c.data_type + ' null=' + c.is_nullable + ' default=' + (c.column_default ?? 'none'));
  const cons = await sql`select conname, pg_get_constraintdef(oid) as def from pg_constraint where conrelid = to_regclass('public.' || ${table})`;
  for (const c of cons) log('   cons ' + c.conname + ' :: ' + c.def);
  const idx = await sql`select indexname, indexdef from pg_indexes where tablename=${table}`;
  log('   indexes=' + idx.length + ' :: ' + idx.map((i) => i.indexname).join(', '));
  const rls = await sql`select relrowsecurity, relforcerowsecurity from pg_class where oid = to_regclass('public.' || ${table})`;
  log('   rls=' + JSON.stringify(rls[0] ?? null));
  const pol = await sql`select polname, polcmd from pg_policy where polrelid = to_regclass('public.' || ${table})`;
  log('   policies=' + pol.length + ' :: ' + pol.map((p) => p.polname + '(' + p.polcmd + ')').join(', '));
  const cnt = await sql.unsafe(`select count(*)::int c from public.${table}`);
  log('   rows=' + cnt[0].c);
  return cols;
}

try {
  await shape('chat_history');
  await shape('agent_messages');
  const gr = await sql`select grantee, privilege_type from information_schema.role_table_grants where table_name='chat_history' order by grantee`;
  log('== grants chat_history=' + gr.length);
  for (const g of gr) log('   ' + g.grantee + ' :: ' + g.privilege_type);
  const latest = await sql`select id, user_id, role, left(content, 40) as head, created_at from chat_history order by created_at desc limit 5`;
  log('== latest chat_history rows=' + latest.length);
  for (const r of latest) log('   ' + String(r.id) + ' user=' + (r.user_id ?? 'none') + ' ' + r.role + ' ' + (r.head ?? ''));
} catch (e) { log('ERROR: ' + String(e && e.message ? e.message : e)); } finally { await sql.end(); fs.writeFileSync('scratch/measure-chat-table.out', out.join('\n') + '\n'); }
