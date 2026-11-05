/**
 * What real numbers exist for the cockpit's pulse bar, measured against the live
 * database before a single pixel is designed. Prints counts and table names only.
 */
import fs from 'fs';

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z]/.test(l) && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')])
);
const U = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const K = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}`, Prefer: 'count=exact' };

const count = async (table, query = 'select=id&limit=1') => {
  try {
    const r = await fetch(`${U}/rest/v1/${table}?${query}`, { headers: H });
    if (r.status === 404) return 'NO TABLE';
    const range = r.headers.get('content-range') || '';
    return `${range.split('/')[1] ?? '?'} (http ${r.status})`;
  } catch (e) {
    return `ERR ${e.message.slice(0, 30)}`;
  }
};

const since24 = new Date(Date.now() - 864e5).toISOString();
const since7 = new Date(Date.now() - 7 * 864e5).toISOString();

const candidates = [
  'visits', 'visitors', 'page_views', 'visitor_events', 'analytics_events', 'traffic_events',
  'room_sketches', 'sketches', 'paper_sketches', 'floor_plans', 'cad_uploads', 'uploads', 'attachments',
  'consultant_sessions', 'leads', 'users', 'requests', 'sales_orders', 'bookings', 'lead_conversions',
  'agent_tasks', 'agent_messages', 'ops_sync_events', 'customer_roll', 'customers',
];

console.log('--- tables that exist, all-time rows ---');
for (const t of candidates) {
  const c = await count(t);
  if (c !== 'NO TABLE') console.log(`  ${t} = ${c}`);
}

console.log('--- the last 24 hours, where a time column exists ---');
const timed = [
  ['agent_messages', 'created_at'],
  ['agent_tasks', 'created_at'],
  ['ops_sync_events', 'created_at'],
  ['consultant_sessions', 'created_at'],
  ['leads', 'created_at'],
  ['users', 'created_at'],
  ['requests', 'created_at'],
  ['bookings', 'created_at'],
];
for (const [t, col] of timed) {
  const c = await count(t, `select=id&${col}=gte.${since24}&limit=1`);
  if (c !== 'NO TABLE') console.log(`  ${t} since24 = ${c}`);
}

console.log('--- unread from the swarm to the owner (last 7 days) ---');
console.log(`  agent_messages unread = ${await count('agent_messages', `select=id&sender_type=eq.agent&is_read=is.false&created_at=gte.${since7}&limit=1`)}`);
console.log(`  agent_tasks open      = ${await count('agent_tasks', `select=id&status=in.(pending,running,queued)&limit=1`)}`);
