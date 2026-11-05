/**
 * sweep-alert-probe.mjs — finds every ledger row any of my instruments wrote, by the marker text
 * inside its own payload, whatever shape that payload ended up in (object or double-encoded string).
 * The earlier cleanup matched `payload->>'summary'`, which returns nothing when the row was stored as
 * a JSON string — so it printed "0 left" about rows it could not see.
 */
import postgres from 'postgres';
import fs from 'node:fs';
import dotenv from 'dotenv';
for (const f of ['.env.local', '.env']) { const p = process.cwd() + '/' + f; if (fs.existsSync(p)) dotenv.config({ path: p }); }
const sql = postgres(process.env.DIRECT_URL, { ssl: 'require', max: 1 });
const out = []; const log = (s) => { out.push(s); console.log(s); };

const MARKERS = ['سطر قياس حيّ للشريط', 'سطر قياس شكله'];
const ACK_TYPE = 'owner_alert_acknowledged';

try {
  const like = `%${MARKERS[0]}%`;
  const like2 = `%${MARKERS[1]}%`;
  const found = await sql`
    select id, event_type, jsonb_typeof(payload) as shape, created_at, left(payload::text, 90) as head
    from ops_sync_events
    where payload::text like ${like} or payload::text like ${like2}
    order by id`;
  log('FOUND_ROWS=' + found.length);
  for (const r of found) log(`  row ${r.id} | ${r.event_type} | shape=${r.shape} | ${new Date(r.created_at).toISOString()} | ${r.head}`);

  const ids = found.map((r) => r.id);
  if (ids.length) {
    await sql`delete from ops_sync_events where id = any(${ids}::bigint[])`;
  }
  const ackHeads = await sql`
    select a.id, a.payload->>'alert_id' as target from ops_sync_events a
    where a.event_type = ${ACK_TYPE}
      and (a.payload->>'alert_id')::bigint = any(${ids.length ? ids : [-1]}::bigint[])`;
  log('ACK_ROWS_FOR_THOSE_IDS=' + ackHeads.length);
  for (const a of ackHeads) log(`  ack ${a.id} closes ${a.target}`);
  if (ackHeads.length) {
    const ackIds = ackHeads.map((a) => a.id);
    await sql`delete from ops_sync_events where id = any(${ackIds}::bigint[])`;
  }

  const after = await sql`
    select count(*)::int c from ops_sync_events
    where payload::text like ${like} or payload::text like ${like2}`;
  log('RESIDUE_BY_TEXT=' + after[0].c);
  const total = await sql`select count(*)::int c from ops_sync_events`;
  log('LEDGER_ROWS_AFTER=' + total[0].c);
} catch (e) {
  log('ERROR: ' + String(e && e.stack ? e.stack : e).slice(0, 300));
} finally {
  await sql.end();
  fs.writeFileSync('scratch/sweep-alert-probe.out', out.join('\n') + '\n');
}
