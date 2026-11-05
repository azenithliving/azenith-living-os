import postgres from 'postgres';
import fs from 'node:fs';
import dotenv from 'dotenv';
for (const f of ['.env.local', '.env']) { const p = process.cwd() + '/' + f; if (fs.existsSync(p)) dotenv.config({ path: p }); }
const sql = postgres(process.env.DIRECT_URL, { ssl: 'require', max: 1 });
const out = []; const log = (s) => { out.push(s); console.log(s); };
try {
  const cols = await sql`select column_name, data_type, is_nullable, column_default from information_schema.columns where table_name='agent_memory' order by ordinal_position`;
  log('COLUMNS=' + cols.length);
  for (const c of cols) log('  ' + c.column_name + ' :: ' + c.data_type + ' null=' + c.is_nullable + ' default=' + (c.column_default ?? 'none'));

  const trig = await sql`select tgname from pg_trigger t where t.tgrelid = 'agent_memory'::regclass and not t.tgisinternal`;
  log('TRIGGERS=' + trig.length);
  for (const t of trig) log('  ' + t.tgname);

  const rows = await sql`select id, type, memory_type, category, priority, outcome, user_id, user_feedback, created_at, jsonb_typeof(content) as content_shape, left(content #>> '{}', 60) as content_head from agent_memory order by created_at`;
  log('ROWS=' + rows.length);
  for (const r of rows) {
    log('  row id=' + String(r.id).slice(0, 8) + ' type=' + (r.type ?? '-') + ' memory_type=' + (r.memory_type ?? '-') +
      ' cat=' + (r.category ?? '-') + ' prio=' + (r.priority ?? '-') + ' outcome=' + (r.outcome ?? '-') +
      ' user=' + (r.user_id ? String(r.user_id).slice(0, 8) : 'none') + ' shape=' + r.content_shape + ' head=' + (r.content_head ?? '-'));
  }

  const chk = await sql`select conname, pg_get_constraintdef(oid) as def from pg_constraint where conrelid = 'agent_memory'::regclass`;
  log('CONSTRAINTS=' + chk.length);
  for (const c of chk) log('  ' + c.conname + ' :: ' + c.def);
} catch (e) { log('ERROR: ' + String(e && e.message ? e.message : e)); } finally { await sql.end(); fs.writeFileSync('scratch/measure-memory-table.out', out.join('\n') + '\n'); }
