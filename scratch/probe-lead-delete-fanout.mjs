#!/usr/bin/env node
// Read-only probe: what does the leads delete door actually match?
// Nothing here writes. Delete statements are never issued.
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) config({ path: resolve(process.cwd(), '.env') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/["']/g, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/["']/g, '');
if (!url || !key) { console.log('NO_CREDENTIALS'); process.exit(0); }
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const line = (label, rows, err) =>
  console.log(`${label.padEnd(46)} ${err ? 'ERROR: ' + err.message.slice(0, 120) : rows.length + ' rows'}`);

// 1. The keys the screen would send for the newest leads.
const { data: sessions } = await sb.from('consultant_sessions').select('id,session_id').order('updated_at', { ascending: false }).limit(8);
const { data: reqs } = await sb.from('requests').select('id,user_id,users(session_id)').order('created_at', { ascending: false }).limit(8);
const keys = [
  ...(sessions || []).map((s) => s.session_id),
  ...(reqs || []).map((r) => r.users?.session_id ?? r.id),
];
console.log('keys the screen sends for 16 newest leads:', keys.length);

// 2. What the CURRENT door deletes by, measured as reads.
for (const [table, col] of [
  ['visitor_telemetry', 'session_id'],
  ['consultant_sessions', 'session_id'],
  ['users', 'session_id'],
]) {
  const { data, error } = await sb.from(table).select('id').in(col, keys);
  line(`BY ${table}.${col} (correct space)`, data || [], error);
}

// 3. The two statements that mix identifier spaces.
{
  const { data, error } = await sb.from('consultant_sessions').select('id').in('id', keys);
  line('BY consultant_sessions.id (wrong space)', data || [], error);
}
{
  const { data, error } = await sb.from('requests').select('id').in('id', keys);
  line('BY requests.id (wrong space for session keys)', data || [], error);
}

// 4. Reachable through users, and orphaned requests nobody can reach.
{
  const { data: users } = await sb.from('users').select('id').in('session_id', keys);
  const ids = (users || []).map((u) => u.id);
  line('requests reachable via users.user_id', ids.length ? (await sb.from('requests').select('id').in('user_id', ids)).data || [] : [], null);
}
{
  const { count } = await sb.from('requests').select('id', { count: 'exact', head: true }).is('user_id', null);
  console.log('requests with no user (unlinkable by session):', count);
}
{
  const { count: cs } = await sb.from('consultant_sessions').select('id', { count: 'exact', head: true });
  const { count: uu } = await sb.from('users').select('id', { count: 'exact', head: true });
  const { count: rq } = await sb.from('requests').select('id', { count: 'exact', head: true });
  const { count: vt } = await sb.from('visitor_telemetry').select('id', { count: 'exact', head: true });
  console.log(`ledger totals  sessions=${cs}  users=${uu}  requests=${rq}  telemetry=${vt}`);
}
