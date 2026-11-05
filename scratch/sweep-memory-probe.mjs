import postgres from 'postgres';
import fs from 'node:fs';
import dotenv from 'dotenv';
for (const f of ['.env.local', '.env']) { const p = process.cwd() + '/' + f; if (fs.existsSync(p)) dotenv.config({ path: p }); }
const sql = postgres(process.env.DIRECT_URL, { ssl: 'require', max: 1 });
const out = []; const log = (s) => { out.push(s); console.log(s); };
const MARK = 'بروفة الذاكرة';
const like = `%${MARK}%`;
try {
  const memResidue = await sql`select count(*)::int c from agent_memory where content::text like ${like}`;
  log('memory_residue=' + memResidue[0].c);
  const execFound = await sql`select id, execution_type, execution_status from agent_executions where execution_data::text like ${like}`;
  log('executions_found=' + execFound.length);
  for (const e of execFound) log('  exec ' + String(e.id).slice(0, 8) + ' ' + e.execution_type + ' ' + e.execution_status);
  const gone = await sql`delete from agent_executions where execution_data::text like ${like} returning id`;
  log('executions_deleted=' + gone.length);
  const after = await sql`select count(*)::int c from agent_executions where execution_data::text like ${like}`;
  log('executions_residue=' + after[0].c);
  const mem = await sql`select count(*)::int c from agent_memory`;
  log('memory_total=' + mem[0].c);
  const shelf = await sql`select count(*)::int c from agent_memory where category='admin_owner_memory'`;
  log('owner_shelf=' + shelf[0].c);
  const chat = await sql`select count(*)::int c from chat_history`;
  log('chat_history_total=' + chat[0].c);
} catch (e) { log('ERROR: ' + String(e && e.message ? e.message : e)); } finally { await sql.end(); fs.writeFileSync('scratch/sweep-memory-probe.out', out.join('\n') + '\n'); }
