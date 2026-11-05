/**
 * prove-learning-mode-hole.mjs — can a stranger teach the manager?
 *
 * The public advisor door decides «admin learning mode» from a `userEmail` that arrives IN THE REQUEST
 * BODY, and it writes with the service-role client. This asks the published door, with no cookie and no
 * session, to save a rule of the probe's own, then reads the record for it. Whatever the answer, the
 * probe deletes only its own row, matched by its own text.
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";

const SITE = "https://azenith-living.vercel.app";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const MARK = "قياس أمني — قاعدة مزروعة من محاجة الباب";
const adminEmails = (env.MASTER_ADMIN_EMAILS || "").split(",").map((e) => e.trim()).filter(Boolean);
console.log("عدد بريدات الإدارة في البيئة:", adminEmails.length);

const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });
// A previous run of this probe may have died mid-way; clear only its own marker text first.
const stale = await sql`delete from consultant_learnings where instruction = ${MARK} returning id`;
if (stale.length) console.log("أثر قديم من نفس المحاجة اتمسح:", stale.length);
const before = (await sql`select count(*)::int c from consultant_learnings`)[0].c;
console.log("سطور القواعد قبل القياس:", before);

const res = await fetch(`${SITE}/api/consultant`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: MARK, userEmail: adminEmails[0], language: "ar" }),
});
const body = await res.json().catch(() => null);
console.log("الباب ردّ بالحالة:", res.status);
console.log("الباب قال (مقتطف):", String(body?.reply ?? JSON.stringify(body ?? {})).slice(0, 120));

const rows = await sql`select id from consultant_learnings where instruction = ${MARK}`;
const after = (await sql`select count(*)::int c from consultant_learnings`)[0].c;
console.log("سطور القواعد بعد القياس:", after);
console.log("القاعدة المزروعة اتلاقت في السجل:", rows.length > 0 ? "نعم — الباب كتب" : "لأ — الباب ما كتبش");

const gone = rows.length ? await sql`delete from consultant_learnings where instruction = ${MARK} returning id` : [];
const residue = (await sql`select count(*)::int c from consultant_learnings where instruction = ${MARK}`)[0].c;
const finalCount = (await sql`select count(*)::int c from consultant_learnings`)[0].c;
console.log("ممسوح من أثر المحاجة:", gone.length, "| فاضل:", residue, "| العدد رجع:", finalCount === before ? "نعم" : `لأ (${finalCount} مقابل ${before})`);
console.log("الحكم:", rows.length > 0 ? "الثغرة موجودة: زائر بلا دخول بيعلّم المدير" : "الثغرة مقفولة: لا كتابة بدون جلسة إدارة");

await sql.end();
