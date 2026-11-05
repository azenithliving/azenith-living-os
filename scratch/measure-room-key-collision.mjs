import { config as loadEnv } from "dotenv";
import postgres from "postgres";
loadEnv({ path: ".env.local" });
const { roomLabel } = await import("./lib/cad/room-names.ts").catch(() => ({ roomLabel: null }));
const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1 });
const rows = await sql`select room_type, count(*)::int c from curated_images where is_active = true group by room_type order by c desc`;
console.log("عدد مفاتيح الغرف المختلفة:", rows.length);
const byLabel = new Map();
for (const r of rows) {
  const label = r.room_type ?? "(فاضي)";
  byLabel.set(label, (byLabel.get(label) ?? []).concat(`${r.room_type}=${r.c}`));
}
console.log("كل مفتاح وكرره:", rows.map((r) => `${r.room_type}=${r.c}`).join(" · "));
await sql.end();
