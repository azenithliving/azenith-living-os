import fs from "node:fs";

/**
 * Appends the owner-dashboard alert atom to the running log. Every number is re-measured from the
 * live record in this run or parsed from a file a tool wrote in this session; digits are typed
 * Latin and converted to the owner's numerals by the same pass that guards the prose.
 */
const path = "docs/ledger/council-minutes.md";
const when = new Date().toISOString().slice(0, 16).replace("T", " ");
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
const sql = await import("postgres").then((m) => m.default(process.env.DIRECT_URL, { ssl: "require", max: 1 }));
const COMPANY = process.env.ADMIN_COMPANY_ID?.trim();

const deadRows = (await sql`select count(*)::int c from agent_events`)[0].c;
const ledgerRows = (await sql`select count(*)::int c from ops_sync_events`)[0].c;
const ownPapers = (await sql`select count(*)::int c from approval_requests where status = 'pending' and company_id = ${COMPANY}`)[0].c;
const orphanPapers = (await sql`select count(*)::int c from approval_requests where status = 'pending' and company_id is null`)[0].c;
const pendingAll = (await sql`select count(*)::int c from approval_requests where status = 'pending'`)[0].c;
const devices = (await sql`select count(*)::int c from agent_devices where is_active = true`)[0].c;
await sql.end();

const ANSI = new RegExp("[" + String.fromCharCode(27) + "]" + "[[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZc-n>]", "g");
const readMatch = (file, re) => {
  const text = fs.readFileSync(file, "utf8").replace(ANSI, "");
  const m = text.match(re);
  if (!m) throw new Error(`${file} has no match for ${re}`);
  return m;
};

const proof = readMatch("scratch/prove-owner-dashboard.out", /(ALL_PASS|SOME_FAIL) — (\d+)\/(\d+)/);
const overdueOwn = readMatch("scratch/prove-owner-dashboard.out", /ورق مستني من امبارح: (\d+)/)[1];
const residue = readMatch("scratch/prove-owner-dashboard.out", /فاضل من سطري بعد التنظيف: (\d+)/)[1];
const ledgerAfter = readMatch("scratch/prove-owner-dashboard.out", /سطور الدفتر بعد التنضيف: (\d+)/)[1];
const tests = readMatch("scratch/dash-fullsuite.out", /Tests\s+(\d+) passed/)[1];
const guards = (fs.readFileSync("tests/ops/ownerDashboardAlerts.test.ts", "utf8").match(/^\s*it\(/gm) ?? []).length;

const T = {
  WHEN: when,
  DEAD_ROWS: deadRows,
  LEDGER: ledgerRows,
  LEDGER_AFTER: ledgerAfter,
  OWN_PAPERS: ownPapers,
  ORPHAN_PAPERS: orphanPapers,
  PENDING_ALL: pendingAll,
  OVERDUE_OWN: overdueOwn,
  DEVICES: devices,
  PROOF: proof[2],
  PROOF_TOTAL: proof[3],
  RESULT: proof[1] === "ALL_PASS" ? "كلها نجحت" : "فيها فشل",
  RESIDUE: residue,
  TESTS: tests,
  GUARDS: guards,
};

const lines = [
  "",
  "- **الوكيل ({WHEN}):** **تنبيهات لوحة المالك بقت بتتقرا من دفتر المتجر — الشاشة كانت بتطمنك من غير ما تقيس.**",
  "  **القياس على القاعدة الحيّة:** الباب كان بيستعلم على الجدول الميت بفلترين على عمودين مش موجودين («درجة الأهمية» و«اتقريت»)، فالاستعلام كان بيفشل في كل مرة، والخطأ كان بيتحوّل لقائمة فاضية، والسطر اللي تحتها كان بيقول «جميع الأنظمة مستقرة» · بلاية «متأخرات» كانت بتعدّ نفس التنبيهات بدرجة أهمية مش موجودة فالرقم بتاعها صفر أبدي · رقم الأجهزة المتصلة كان مكتوب في الكود `null` (يعني الشاشة بتعرض صفر من غير ما تسأل القاعدة) · وورق مستني من غير تاريخ استحقاق محسوب: المهام اللي في السجل مفيش ولا واحدة فيها عمود الموعد مملول، فأي «متأخرات» محسوبة منها كانت هتفضل صفر كمان.",
  "  **اللي اتعمل:** التنبيهات بتتقرا من الدفتر من ورا القاعدة الواحدة، بس بطلب نافذة اليوم كله (القاعدة نفسها، مش نسخة تانية منها) · لو الدفتر ما ردّش، القسم بيقول هو نفسه ما قريش بدل ما يطمنك · بلاية الانتظار بقت بتعدّ الأوراق اللي استنّت يومًا فعلًا عند صاحب الدار (**{OVERDUE_OWN}** من **{OWN_PAPERS}** ورق مستني له) · الأجهزة المتصلة بقت مقاسة من السجل (**{DEVICES}**) · الكروت اللي كانت أسماها إنجليزي رجعت عربي («مدير المبيعات» و«أجهزة متصلة») والأرقام بقت بحروفه العربية، واللي ما اتقستش بيتقال «ما اتقستش» · كمان آخر قارئ للجدول الميت قفل، فالجدول (**{DEAD_ROWS}** سطر استعراض من 2026-08-10) بقى مفيش ولا شاشة بتقرأه.",
  "  **القياس الحيّ على الرابط المنشور:** `scratch/prove-owner-dashboard-alerts.mjs` — **{RESULT} {PROOF} من {PROOF_TOTAL}**: سطر قياس واحد اتسجّل في الدفتر وطلع على لوحة المالك بنفس الجملة العربية وموعدها بحروفه · اتعلم مقروء من باب التنبيهات فرحّت الوصلة، فالسطر اختفى من اللوحة ومن الشريط الأحمر ومن شريط اللوحة القديمة (قفل نفس السطر من تلات شاشات بقاعدة واحدة) · الراحة رجعت جملة مقاسة مش وعد · مفيش لاتيني على الكروت، وصورة الكارت اتبصّيت عليها · **{RESIDUE}** سطر فاضل من أدواتي، والدفتر رجع **{LEDGER_AFTER}** سطر (= **{LEDGER}**).",
  "  **عيب جديد طلعه نفس القياس (اتسجل مهمة):** في **{ORPHAN_PAPERS}** ورقة من **{PENDING_ALL}** مستنية كلمة المالك ملهاش شركة في السجل · مكتب القرار وعدّاد الجنب بيضمّوا الأوراق دي عمدًا، بس باب القرار بيفلتر على شركة المتجر، فالورقة اللي ملهاش شركة ما بتتفصلش · والنتيجة إن اللوحة دي بتعدّ **{OWN_PAPERS}** والعدّاد بيعدّ **{PENDING_ALL}** — مجموعتين مختلفتين لنفس السؤال.",
  "  **البوابات:** {TESTS} اختبار أخضر (خروج 0) · تيبشك سليم · بناء كامل · منشور · **{GUARDS} حارس** على اللوحة دي: لا استعلام على الجدول الميت، لا رقم متجمّد في الكود، لا وعد «الأنظمة مستقرة» في أي شاشة، والأرقام بحروف المالك.",
  "",
];

const toArabic = (s) => s.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬");
const body = lines
  .map((l) => l.replace(/\{([A-Z_0-9]+)\}/g, (_, k) => String(T[k])))
  .map(toArabic)
  .join("\n");

const allowed = Object.values(T).map(String).join("");
const strays = (body.match(/[0-9]+/g) ?? []).filter((r) => !allowed.includes(r));
if (strays.length) throw new Error("Latin digits outside the tokens: " + strays.join(", "));
const prose = body.replace(/`[^`]*`/g, "");
const words = (prose.match(/[A-Za-z]{3,}/g) ?? []).filter((w) => !allowed.toLowerCase().includes(w.toLowerCase()));
if (words.length) throw new Error("Latin words leaked: " + words.join(", "));
if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\u0590-\u05ff]/.test(body)) throw new Error("a non-Arabic script leaked into the prose");
if (/\{[A-Z_0-9]+\}/.test(body)) throw new Error("an unreplaced token survived");

fs.appendFileSync(path, body, "utf8");
console.log("appended lines:", body.split("\n").length - 2);
console.log("المقاس:", JSON.stringify({ deadRows, ledgerRows, ownPapers, orphanPapers, devices, overdueOwn, proof: proof[0], residue, tests, guards }));
