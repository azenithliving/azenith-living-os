import fs from 'node:fs';
const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const list = (k) => (env[k] || '').split(',').map((s) => s.trim()).filter(Boolean);
const pex = list('PEXELS_KEYS');
let ok = 0, codes = {};
for (const key of pex.slice(0, 5)) {
  const r = await fetch('https://api.pexels.com/v1/search?query=luxury%20kitchen&per_page=1', { headers: { Authorization: key } });
  codes[r.status] = (codes[r.status] || 0) + 1;
  if (r.ok) { const j = await r.json(); if (Array.isArray(j.photos) && j.photos.length) ok++; }
}
console.log(`pexels: tried ${Math.min(5, pex.length)} · answering with photos: ${ok} · statuses: ${JSON.stringify(codes)}`);

const gem = list('GOOGLE_AI_KEYS');
const aiza = gem.filter((k) => k.startsWith('AIzaSy'));
const other = gem.filter((k) => !k.startsWith('AIzaSy'));
console.log(`google: total ${gem.length} · accepted by the harvester's own rule ${aiza.length} · silently dropped ${other.length}`);

async function askGoogle(key, model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'reply with the single word: ok' }] }] }),
  });
  const body = await r.text();
  let note = '';
  try { const j = JSON.parse(body); note = j?.error?.status || j?.error?.message?.slice(0, 60) || ''; } catch {}
  return { status: r.status, note };
}
for (const [label, key] of [['AIzaSy key', aiza[0]], ['dropped-prefix key', other[0]]]) {
  if (!key) { console.log(`${label}: none`); continue; }
  const a = await askGoogle(key, 'gemini-2.0-flash');
  const b = a.status === 400 || a.status === 404 ? await askGoogle(key, 'gemini-flash-latest') : a;
  console.log(`${label}: first try ${a.status} ${a.note} · second model ${b.status} ${b.note}`);
}
