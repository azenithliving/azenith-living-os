const postgres = require("postgres");

/**
 * Does the bank's cover function answer for all sixteen storefront rooms?
 *
 * This is the door's own query, run from the shell: the same function, the same list of types the
 * storefront now sends. It is checked here because the answer decides what the browser proof should
 * show — and a proof that only measures a page cannot say whether a missing card is the bank's fault
 * or the code's.
 */
const TYPES = [
  "living-room",
  "dining-room",
  "kitchen",
  "master-bedroom",
  "guest-bedroom",
  "children-room",
  "teen-room",
  "dressing-room",
  "home-office",
  "study-room",
  "bathroom",
  "guest-bathroom",
  "entrance-lobby",
  "corner-sofa",
  "lounge",
  "comprehensive-interior",
];

const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });

(async () => {
  const literal = "'{" + TYPES.join(",") + "}'::text[]";
  const rows = await sql.unsafe(
    "select out_room_type, out_style, left(out_url, 26) as u from public.pick_room_covers(" + literal + ", null)"
  );
  const byRoom = {};
  for (const r of rows) byRoom[r.out_room_type] = (byRoom[r.out_room_type] ?? 0) + 1;
  console.log(`خلايا (غرفة/طراز) راجعة من الباب: ${rows.length}`);
  for (const t of TYPES) console.log(`  ${String(byRoom[t] ?? 0).padStart(2)} / 4   ${t}`);
  const missing = TYPES.filter((t) => !byRoom[t]);
  console.log(missing.length ? `  مفيش خالص: ${missing.join(" ، ")}` : "  كل الغرف الستة عشر عندها غلاف واحد على الأقل");
  await sql.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
