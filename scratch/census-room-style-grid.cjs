/**
 * Read-only: does the bank hold a picture for every room under every style the storefront offers?
 *
 * The home page has a style switcher, so a room's cover has to answer to the style being shown or it
 * is a picture of the wrong promise. This prints the room x style grid the storefront would see.
 */
const dotenv = require("dotenv");
const path = require("path");
const postgres = require("postgres");

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });

(async () => {
  const styles = await sql`select style, count(*)::int as n from public.curated_images where is_active group by style order by n desc`;
  console.log("styles in the bank:", styles.map((s) => `${s.style ?? "(null)"}=${s.n}`).join(", "));

  const offered = await sql`
    select distinct on (room_type, coalesce(style,'(none)')) room_type, coalesce(style,'(none)') as style
      from public.curated_images where is_active order by room_type, style`;
  const grid = new Map();
  for (const row of offered) {
    if (!grid.has(row.room_type)) grid.set(row.room_type, []);
    grid.get(row.room_type).push(row.style);
  }
  console.log("\nroom_type · styles held");
  for (const [room, list] of grid) console.log(`  ${String(room).padEnd(24)} ${list.join(", ")}`);

  const counts = await sql`
    select room_type, coalesce(style,'(none)') as style, count(*)::int as n,
           count(*) filter (where metadata ? 'ai_score') as scored,
           max((metadata->>'ai_score')::numeric) as best
      from public.curated_images where is_active group by 1,2 order by room_type, n desc`;
  console.log("\nroom x style cells =", counts.length);
  for (const c of counts) {
    console.log(`  ${String(c.room_type).padEnd(24)} ${String(c.style).padEnd(12)} rows=${String(c.n).padStart(4)} scored=${String(c.scored).padStart(4)} best=${c.best ?? "—"}`);
  }
})()
  .catch((e) => {
    console.error("census failed:", e.message);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
