import postgres from 'postgres';
import fs from 'node:fs';
import dotenv from 'dotenv';
for (const f of ['.env.local', '.env']) { const p = process.cwd() + '/' + f; if (fs.existsSync(p)) dotenv.config({ path: p }); }
const sql = postgres(process.env.DIRECT_URL, { ssl: 'require', max: 1 });
const out = []; const log = (s) => { out.push(s); console.log(s); };
try {
  const conf = await sql`
    select n.nspname as fkey_schema, c.conname, confrelid::regclass as target
    from pg_constraint c join pg_class r on r.oid = c.conrelid join pg_namespace n on n.oid = r.relnamespace
    where r.relname = 'agent_memory' and c.contype = 'f'`;
  for (const c of conf) log('FKEY ' + c.conname + ' -> ' + c.fkey_schema + '.' + String(c.target));

  const probes = ['d4f07c29-723d-4239-b55a-4c832ae49bb7'];
  const authOwner = await sql`select id::text as id from auth.users`;
  for (const a of authOwner) probes.push(a.id);
  for (const id of probes) {
    const inPublic = await sql`select count(*)::int as n from public.users where id = ${id}`;
    const inAuth = await sql`select count(*)::int as n from auth.users where id = ${id}`;
    log('probe ' + id.slice(0, 8) + ' public.users=' + inPublic[0].n + ' auth.users=' + inAuth[0].n);
  }
  const memNull = await sql`select count(*)::int as n from agent_memory where user_id is null`;
  log('memory rows with NULL user=' + memNull[0].n);
} catch (e) { log('ERROR: ' + String(e && e.message ? e.message : e)); } finally { await sql.end(); fs.writeFileSync('scratch/measure-memory-fkey.out', out.join('\n') + '\n'); }
