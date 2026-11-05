import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import postgres from "postgres";
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local") });
const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL, { ssl: "require", max: 1 });
try {
  const rows = await sql`select id, room, dimensions::text as dims, area_sqm, ok, confirmed_at, frozen_hash is not null as sealed, token is not null as has_token from public.room_sketches where dimensions::text <> '[]' order by id desc limit 6`;
  for (const r of rows) console.log(`#${r.id} room=${JSON.stringify(r.room)} area=${r.area_sqm} ok=${r.ok} sealed=${r.sealed} dims=${String(r.dims).slice(0, 240)}`);
  const names = await sql`select id, full_name from public.users where full_name ilike '%طارق%' limit 3`;
  for (const n of names) console.log(`user #${n.id} ${n.full_name}`);
} catch (e) { console.error("failed:", e?.message ?? e); process.exitCode = 1; } finally { await sql.end(); }
