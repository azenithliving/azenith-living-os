import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>/^[A-Z]/.test(l)&&l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).replace(/^"|"$/g,'')]));
const U = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL; const K = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}` };
const r = await fetch(`${U}/rest/v1/room_sketches?select=id,created_at,ok,failure,witnesses,room&order=created_at.desc&limit=6`, { headers: H });
for (const row of await r.json()) console.log(row.id, JSON.stringify(row.witnesses?.offline), '| room=', row.room, '|', String(row.failure).slice(0,70));
