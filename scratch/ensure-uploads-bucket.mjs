import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>/^[A-Z]/.test(l)&&l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).replace(/^"|"$/g,'')]));
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
const list = await fetch(`${U}/storage/v1/bucket`, { headers: H });
const buckets = await list.json();
console.log('buckets now:', Array.isArray(buckets) ? buckets.map(b=>b.name).join(', ') : JSON.stringify(buckets).slice(0,120));
if (Array.isArray(buckets) && buckets.some(b => b.name === 'customer-uploads')) { console.log('already there'); process.exit(0); }
const made = await fetch(`${U}/storage/v1/bucket`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'customer-uploads', public: false, fileSizeLimit: 5242880, allowedMimeTypes: ['image/png','image/jpeg','image/webp','image/gif'] }) });
console.log('create http=' + made.status, (await made.text()).slice(0, 160));
