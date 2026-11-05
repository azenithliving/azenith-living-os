/**
 * Read-back of the cover picker: call it twice and compare, then ask every picture it named whether
 * it actually loads.
 *
 * The defect being fixed is instability — a room showing one picture to a visitor and another on
 * reload — so the proof is that the same (room, style) cell answers with the same row twice, that the
 * pictures load, and that cells the bank does not hold are reported as absent rather than filled with
 * a substitute.
 */
const dotenv = require("dotenv");
const path = require("path");
const postgres = require("postgres");

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });

const TYPES = [
  "master-bedroom", "living-room", "dining-room", "children-room", "teen-room",
  "corner-sofa", "comprehensive-interior", "lounge", "dressing-room", "kitchen", "home-office",
];
const LIST = TYPES.join(",");

async function call() {
  const rows = await sql`select * from public.pick_room_covers(string_to_array(${LIST}, ','), null)`;
  const cells = {};
  for (const row of rows) {
    cells[`${row.out_room_type}/${row.out_style}`] = `${row.out_image_id}:${row.out_score ?? "unscored"}`;
  }
  return { cells, rows };
}

async function probe(url) {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    return res.status;
  } catch {
    return 0;
  }
}

(async () => {
  const first = await call();
  const second = await call();
  const keys = Object.keys(first.cells).sort();
  console.log(`cells answered = ${keys.length} (room x style)`);
  let stable = 0;
  for (const key of keys) {
    const same = first.cells[key] === second.cells[key];
    if (same) stable += 1;
    console.log(`  ${key.padEnd(38)} ${first.cells[key]}${same ? "" : "  · CHANGED — defect"}`);
  }
  console.log(`\nsame row on the second call = ${stable} of ${keys.length}`);

  let ok = 0;
  for (const row of first.rows) {
    const status = await probe(row.out_url);
    if (status === 200) ok += 1;
    else console.log(`  NOT LOADING: ${row.out_room_type}/${row.out_style} → ${status}`);
  }
  console.log(`pictures answering 200 = ${ok} of ${first.rows.length}`);

  const missing = TYPES.filter((t) => !keys.some((k) => k.startsWith(`${t}/`)));
  console.log(`room types the bank does not cover: ${missing.join(", ") || "none"}`);
})()
  .catch((e) => {
    console.error("read-back failed:", e.message);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
