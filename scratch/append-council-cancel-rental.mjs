import fs from "node:fs";

/**
 * Appends the owner's decision to drop the rental/multi-store work from this store.
 * No measured number is asserted that a tool did not print in the same session.
 */
const path = "docs/ledger/council-minutes.md";
const when = new Date().toISOString().slice(0, 16).replace("T", " ");
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
const sql = await import("postgres").then((m) => m.default(process.env.DIRECT_URL, { ssl: "require", max: 1 }));
const companies = (await sql`select count(*)::int c from companies`)[0].c;
const cols = (await sql`select count(*)::int c from information_schema.columns where table_schema='public' and table_name='companies'`)[0].c;
await sql.end();

const ar = (v) => String(v).replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));
const T = { WHEN: when, COMPANIES: ar(companies), COLS: ar(cols) };

const lines = [
  "",
  "- **الوكيل ({WHEN}):** **كلمة المالك أقفلت موضوع تأجير المتاجر: «سيبك خالص من موضوع الايجار ده والغيه من المتجر — هبقى اعمله بعدين كمشروع مستقل».**",
  "  **اللي اتعمل بعد الكلمة:** مفيش أي ذرة نقل لشاشة الشركات، ومفيش أي كود اتكتب للتأجير. الشاشة بتاعة اللوحة القديمة، وتصنيفها في الدفتر: **آلة مشتركة** (باب المستشار ومسار الطلبات بيقرّوا منها اسم الدار ورقم الواتساب) — فتمسي مع اللوحة القديمة بكلمة منه، مش مع نقل الموظفين.",
  "  **مفيش حذف:** السجل فيه **{COMPANIES}** سطر شركة واحد (جدول بـ **{COLS}** عموداً مقاسين النهاردة) وهو سطر داره هو، فالإلغاء معناه وقف النقل مش مسح البيانات.",
  "  **اللي طلع من نفس الطريق وهو يخص متجرك انت (اتسجل تلات مهام مستقلة):** استعلام الإعدادات العامة بيفلتر على عمود `company_id` الجدول مالوش، فبيرفض ويرجع لقراءة من غير فلتر بصمت · فلتر على عمود `slug` في جدول الشركات مش موجود أصلاً (كود ميت) · رقم واتساب الدار ليه نسخة تانية مكتوبة جوه الكود، وصاحبه المفروض يكون لوحة المالك بس.",
  "  **القرار متسجل هنا** عشان أي جلسة بعدها تلاقى «باب الشركات محصور في القديمة» في السجل ما تعدهاش فائت نقل — ده مش فائت، ده ملغي بكلمة المالك.",
  "",
];

const body = lines
  .map((l) => l.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬"))
  .map((l) => l.replace(/\{([A-Z_0-9]+)\}/g, (_, k) => T[k]))
  .join("\n");

const allowed = Object.values(T).join("");
const strays = (body.match(/[0-9]+/g) ?? []).filter((r) => !allowed.includes(r));
if (strays.length) throw new Error("Latin digits outside the tokens: " + strays.join(", "));
const prose = body.replace(/`[^`]*`/g, "");
const words = (prose.match(/[A-Za-z]{3,}/g) ?? []).filter((w) => !allowed.toLowerCase().includes(w.toLowerCase()));
if (words.length) throw new Error("Latin words leaked: " + words.join(", "));
if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\u0590-\u05ff]/.test(body)) throw new Error("a non-Arabic script leaked into the prose");
if (/\{[A-Z_0-9]+\}/.test(body)) throw new Error("an unreplaced token survived");

fs.appendFileSync(path, body, "utf8");
console.log("appended lines:", body.split("\n").length - 2);
console.log("المقاس:", JSON.stringify({ companies, cols }));
