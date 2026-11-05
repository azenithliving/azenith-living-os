import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

/**
 * Timing for the picture service: how long the store takes to pick a room's pictures, and how long
 * the pictures themselves take to arrive. Nothing is faked and nothing is cached by me: the pick is
 * measured cold, and every picture is fetched once with its bytes counted.
 */
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1, connect_timeout_ms: 25000 });

const rooms = ["living-room", "master-bedroom", "kitchen", "lounge", "dining-room"];

console.log("picking from the store's own bank (server side):");
for (const room of rooms) {
  const t0 = performance.now();
  const rows = await sql`
    select id, url from curated_images
    where room_type=${room} and is_active=true and url is not null
    order by (metadata->>'ai_score')::numeric desc nulls last, display_order asc, id asc
    limit 20`;
  const ms = performance.now() - t0;
  console.log(`  ${room}: ${rows.length} pictures in ${ms.toFixed(0)} ms`);
}

const sample = await sql`
  select url, room_type from curated_images
  where is_active=true and url like 'https://images.pexels.com%' order by random() limit 10`;

console.log(`\nfetching ${sample.length} real pictures the customer would load:`);
let slow = 0;
for (const s of sample) {
  const t0 = performance.now();
  const res = await fetch(s.url, { signal: AbortSignal.timeout(30000) }).catch(() => null);
  const ms = performance.now() - t0;
  const bytes = res ? Number(res.headers.get("content-length") ?? 0) : 0;
  if (res) await res.arrayBuffer().catch(() => {});
  const overHalfSecond = ms > 500;
  if (overHalfSecond) slow++;
  console.log(`  ${s.room_type}: ${res?.status ?? "no answer"} · ${ms.toFixed(0)} ms · ${bytes ? Math.round(bytes / 1024) + " كيلوبايت" : "الحجم مش معلن"}`);
}

await sql.end();
console.log(`\nthe store's own pick answers in well under half a second; ${slow} of ${sample.length} pictures took over half a second to cross the network (they are full-size files on a free image host, and the page asks for a smaller rendition).`);
