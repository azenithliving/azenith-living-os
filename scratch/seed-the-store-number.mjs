import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

/**
 * Seeds the store's own numbers record with the number the owner dictated on 2026-10-13:
 * «01090819584 ده الرقم الحالى اللى العميل يوصلى عليه ويظهر فى بيانات الشركة واى صفحة».
 * The value is written in international form because that is the only form a WhatsApp link opens.
 */
const LOCAL = "01090819584";
const INTERNATIONAL = `20${LOCAL.slice(1)}`;

const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1, connect_timeout_ms: 25000 });

const list = [{ value: INTERNATIONAL, label: "الرقم الرئيسي", primary: true }];

await sql`
  insert into site_settings (key, value)
  values (${"contact_numbers"}, ${list}::jsonb)
  on conflict (key) do update set value = excluded.value`;

const back = await sql`select value::text v from site_settings where key='contact_numbers'`;
const stored = back[0] ? JSON.parse(back[0].v) : null;
console.log(`wrote 1 number · stored: ${stored ? `${stored.length} number(s), primary ${String(stored[0]?.value).slice(-4)} ending` : "NOTHING"}`);
console.log(`primary value matches what he dictated: ${stored?.[0]?.value === INTERNATIONAL}`);
await sql.end();
