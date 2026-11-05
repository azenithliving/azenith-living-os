/**
 * Probe the shape of the swarm's event ledger on the live database: the column list,
 * the id type as the API actually returns it, and how many rows each of the two
 * transport machines has written. Prints shapes only — never a key.
 */
import fs from 'fs';

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z]/.test(l) && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')])
);

const URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) {
  console.log('MISSING url or service key in the environment file');
  process.exit(1);
}

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function rows(table, query) {
  const res = await fetch(`${URL}/rest/v1/${table}?${query}`, {
    headers: { ...headers, Prefer: 'count=exact' },
  });
  return { status: res.status, range: res.headers.get('content-range'), body: await res.json().catch(() => null) };
}

const ledger = await rows('ops_sync_events', 'select=*&order=id.desc&limit=2');
console.log(`ops_sync_events http=${ledger.status} count=${ledger.range}`);
if (Array.isArray(ledger.body) && ledger.body[0]) {
  const first = ledger.body[0];
  console.log(`  columns=${Object.keys(first).join(',')}`);
  console.log(`  id sample=${typeof first.id} looksLikeUuid=${/^[0-9a-f]{8}-/i.test(String(first.id))}`);
  console.log(`  newest event_type=${first.event_type} source=${first.source_agent} company=${first.company_id ? 'set' : 'NULL'}`);
}

const bySource = await rows('ops_sync_events', 'select=event_type,count=&group_by=event_type&order=count.desc&limit=6');
console.log(`  types=${JSON.stringify(bySource.body)}`);

const usage = await rows('vanguard_api_usage', "api_name=eq.event_bus&select=endpoint,created_at&order=created_at.desc&limit=3");
console.log(`vanguard_api_usage[event_bus] http=${usage.status} count=${usage.range}`);
if (Array.isArray(usage.body) && usage.body[0]) {
  console.log(`  newest=${usage.body[0].endpoint} at ${usage.body[0].created_at}`);
}
