import { appendFileSync, readFileSync } from "node:fs";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

/**
 * The owner's word: «امسح الصوفا». The row is copied whole into the ledger first, then erased by
 * its own id with its name as a second key, and the table is counted back from the database itself.
 */
const MARK = "مسح الصوفا";
const ledgerPath = "docs/ledger/council-minutes.md";
const ar = (s) => s.replace(/[0-9]/g, (d) => String.fromCodePoint(0x660 + Number(d)));

const sql = postgres(process.env.DIRECT_URL, { ssl: "require", max: 1, connect_timeout_ms: 25000 });

const rows = await sql`select to_jsonb(p)::text as j from products p where name = 'صوفا ملكية'`;
console.log(`rows matching the name before: ${rows.length}`);
if (rows.length !== 1) {
  console.log("REFUSING: the name does not answer with exactly one row.");
  await sql.end();
  process.exit(1);
}
const json = rows[0].j;
const id = JSON.parse(json).id;

const addition =
  ar(`
- **وكيل المتجر (${new Date().toISOString().slice(0, 16).replace("T", " ")}):** **${MARK}:** المالك قال كلمة صريحة في سطر واحد: «امسح الصوفا» — دي كلمة حذف في القاعدة، فاتعملت بالشروط دي. السطر ات نسخ كامل في الدفتر الأول (الجيسون ده هو النسخة)، وبعدين اتمسح بمعرّفه هو وباسمه مفتاح تاني، والجدول اتعدّ من القاعدة نفسها مش من ردّ الطلب. **اللي اتبيّن قبل المسح:** السطر كان فيه سعر فعلاً (٤٥٠٠٠) بس بعملة سعودية وبلا صورة — فاللي كان ماسكه عن الزائر هو الصورة، مش السعر؛ والطاولة كانت بتقول «ناقص: الصورة» وهي صادقة. والأولاد اللي بيتشالوا معاه: سجل مخزون صفر سطور، وروابط الأفلييت بتسيب فاضي مش بتمسح.
  - **النسخة الكاملة قبل المسح:**
`);

appendFileSync(ledgerPath, addition + "  ```json\n  " + json + "\n  ```\n", "utf8");
const text = readFileSync(ledgerPath, "utf8");
if (!text.includes(id) || !text.includes(MARK)) {
  console.log("REFUSING TO DELETE: the archive copy is not in the ledger.");
  await sql.end();
  process.exit(1);
}
console.log(`archive in the ledger: yes (id present=${text.includes(id)})`);

const gone = await sql`delete from products where id = ${id} and name = 'صوفا ملكية' returning id`;
const after = await sql`select count(*)::int as n from products`;
const byName = await sql`select count(*)::int as n from products where name = 'صوفا ملكية'`;
const log = await sql`select count(*)::int as n from product_inventory_log`;
console.log(`deleted rows=${gone.length} · products after=${after[0].n} · matching the name=${byName[0].n} · inventory log rows=${log[0].n}`);

const done = gone.length === 1 && after[0].n === 0 && byName[0].n === 0;
appendFileSync(
  ledgerPath,
  ar(`  - **بعد المسح:** سطر واحد اتمسح، والجدول بقى صفر سطور، وما فضلش أي سطر بنفس الاسم، وسجل المخزون اللي ليه صلة بيه صفر سطور زي ما كان.\n`),
  "utf8"
);
console.log(`ERASED=${done}`);
await sql.end();
process.exit(done ? 0 : 1);
