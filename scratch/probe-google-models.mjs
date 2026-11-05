import fs from 'node:fs';
const env = {};
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const keys = (env.GOOGLE_AI_KEYS || '').split(',').map((s) => s.trim()).filter(Boolean);
const key = keys[0];
const listed = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`);
const data = await listed.json().catch(() => ({}));
const models = (data.models || []).map((m) => m.name.replace("models/", ""));
console.log('list endpoint:', listed.status, '· models advertised:', models.length);
const flash = models.filter((m) => /flash/.test(m));
console.log('flash models Google actually lists:', flash.join(', ') || 'NONE');

const claimed = ["gemini-3.1-flash-lite", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3-flash-preview"];
for (const m of claimed) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'say ok' }] }] }),
  });
  console.log(`  asked for ${m.padEnd(22)} -> ${r.status} ${models.includes(m) ? '(in the list)' : '(NOT in the list)'}`);
}
const vision = models.filter((m) => /gemini-(2|3|flash)/.test(m) && /flash|pro|lite/.test(m)).slice(0, 4);
for (const m of vision) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'say ok' }] }] }),
  });
  console.log(`  real candidate ${m.padEnd(26)} -> ${r.status}`);
}
