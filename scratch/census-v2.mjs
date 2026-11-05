import fs from 'node:fs';
import path from 'node:path';
const root = 'app/admin/v2';
const sep = String.fromCharCode(92);
const out = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === 'page.tsx') out.push(p);
  }
})(root);
const PLACEHOLDER = /(فاضي|سيُنقل|يُنقل لاحق|قريبًا|تحت الإنشاء|placeholder)/;
let empties = 0, real = 0;
for (const f of out) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n').length;
  const dataWired = /from ['"]@\/lib\/|fetch\(['"]\/api\/|supabase/i.test(src);
  const ph = PLACEHOLDER.test(src);
  const handles = (src.match(/data-[a-z-]+=/g) || []).length;
  if (ph && !dataWired) empties++; else real++;
  console.log(`${ph && !dataWired ? 'EMPTY' : 'REAL '} ${String(lines).padStart(5)} ln  data=${dataWired ? 'yes' : 'no '}  ph=${ph ? 'yes' : 'no '}  ${f.split(sep).join('/')}`);
}
console.log(`TOTAL pages ${out.length} · real ${real} · placeholder-only ${empties}`);
