import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>/^[A-Z]/.test(l)&&l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).replace(/^"|"$/g,'')]));
const U = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL; const K = env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.argv[2] || 'https://azenith-living.vercel.app';
const r = await fetch(`${U}/rest/v1/room_sketches?select=id,token,frozen_hash,dimensions&order=id.desc&limit=6`, { headers: { apikey: K, Authorization: `Bearer ${K}` } });
for (const row of await r.json()) {
  if (!row.frozen_hash) { console.log(row.id, 'not sealed'); continue; }
  const j = await (await fetch(`${BASE}/api/passport/${row.token}`)).json();
  console.log(row.id, 'sealed=yes dims=' + JSON.stringify((row.dimensions||[]).map(d=>[d.meters, d.confirmedBy||[]])), '→ sheet says unchanged=' + j.sheet?.unchanged, 'confirmed=' + Boolean(j.sheet?.confirmed_at));
}
