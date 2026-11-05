import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { planFromPaper, shapeFromSideCount } from '../lib/cad/plan';

/**
 * Measures the store's real papers against the drawing builder: how many of them become a room
 * today, how many are waiting for their customer to name a shape, and how many numbers the sheet
 * would have to vouch for. Counts only — no name, no phone, no token is printed.
 *
 * Run: npx ts-node --transpile-only scratch/probe-plan-corpus.ts [--write]
 */
const env: Record<string, string> = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const url = env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error('مفيش مفتاح قراءة في البيئة');
  process.exit(2);
}

const write = process.argv.includes('--write');
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
const { data, error } = await supabase
  .from('room_sketches')
  .select('id,dimensions,openings,area_sqm,plan,confirmed_at,ok')
  .order('id', { ascending: true })
  .limit(500);

if (error) {
  console.error('السجل ما ردّش:', String(error.message).slice(0, 120));
  process.exit(1);
}

const rows = data ?? [];
let drawn = 0;
let closed = 0;
let needsShape = 0;
let disagreeing = 0;
let withOpenings = 0;
let stored = 0;
let wrote = 0;
const sideCounts = new Map<number, number>();
const confirmCounts = new Map<number, number>();

for (const row of rows) {
  const dims = Array.isArray(row.dimensions) ? row.dimensions : [];
  sideCounts.set(dims.length, (sideCounts.get(dims.length) ?? 0) + 1);
  const agreed = dims.filter((d: any) => d?.confirmed).length;
  confirmCounts.set(agreed, (confirmCounts.get(agreed) ?? 0) + 1);
  const built = planFromPaper({ dimensions: dims, openings: Array.isArray(row.openings) ? row.openings : [] });
  if (built.plan) {
    drawn++;
    if (built.plan.complete) closed++;
    if (built.plan.openings.length) withOpenings++;
    if (built.plan.conflicts.length) disagreeing++;
    if (row.plan) stored++;
    if (write && !row.plan) {
      const { error: e } = await supabase
        .from('room_sketches')
        .update({ plan: built.plan, area_sqm: built.plan.complete ? built.plan.areaSqm : row.area_sqm })
        .eq('id', row.id)
        .is('plan', null);
      if (e) console.error('write refused for one paper');
      else wrote++;
    }
  } else {
    needsShape++;
  }
}

const report = [
  `papers read: ${rows.length}`,
  `  draw a room: ${drawn}  (of them closed: ${closed}, with an opening pinned: ${withOpenings}, disagreeing walls: ${disagreeing})`,
  `  need a shape chosen first: ${needsShape}`,
  `  already stored a drawing before this run: ${stored}`,
  ...(write ? [`  drawings written by this run: ${wrote}`] : []),
  `  sides per paper: ${[...sideCounts.entries()].sort((a, b) => a[0] - b[0]).map(([n, c]) => `${n}x${c}`).join('  ')}`,
  `  agreed numbers per paper: ${[...confirmCounts.entries()].sort((a, b) => a[0] - b[0]).map(([n, c]) => `${n}x${c}`).join('  ')}`,
  `  shape the count decides: 2=${shapeFromSideCount(2)} 3=${shapeFromSideCount(3)} 4=${shapeFromSideCount(4)} 6=${shapeFromSideCount(6)}`,
];
process.stdout.write(report.join('\n') + '\n');
process.exit(0);
}

void main();
