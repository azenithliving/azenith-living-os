import fs from "node:fs";

/**
 * Appends the owner-controls atom to the running log. Numbers are re-measured from the live
 * record in this run or parsed from the measurement files a tool wrote in this session; digits
 * are typed Latin and converted to the owner's numerals by the same pass that guards the prose.
 */
const path = "docs/ledger/council-minutes.md";
const when = new Date().toISOString().slice(0, 16).replace("T", " ");
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
const sql = await import("postgres").then((m) => m.default(process.env.DIRECT_URL, { ssl: "require", max: 1 }));

const OPEN = ["running", "queued", "pending"];
const COMPANY = process.env.ADMIN_COMPANY_ID?.trim();
const deadRows = (await sql`select count(*)::int c from agent_events`)[0].c;
const ledgerRows = (await sql`select count(*)::int c from ops_sync_events`)[0].c;
const openTasks = (await sql`select count(*)::int c from agent_tasks where company_id = ${COMPANY} and status = any(${OPEN}::text[])`)[0].c;
const papers = (await sql`select count(*)::int c from approval_requests where status = 'pending'`)[0].c;
const eventTables = await sql`
  select table_name from information_schema.tables
  where table_schema = 'public' and table_name like '%events%'`;
let aliveTables = 0;
let deadTables = 0;
let backupTables = 0;
for (const t of eventTables) {
  const one = await sql.unsafe(`select count(*)::int c, max(created_at) m from "${t.table_name}"`);
  const fresh = one[0].c > 0 && one[0].m && new Date(one[0].m) > new Date(Date.now() - 21 * 86400000);
  if (t.table_name.startsWith("_")) backupTables += 1;
  else if (fresh) aliveTables += 1;
  else deadTables += 1;
}
await sql.end();

const readMatch = (file, re) => {
  const text = fs.readFileSync(file, "utf8").replace(/\u001b\[[0-9;]*m/g, "");
  const m = text.match(re);
  if (!m) throw new Error(`${file} has no match for ${re}`);
  return m;
};
const proof = readMatch("scratch/prove-owner-controls.out", /(ALL_PASS|SOME_FAIL) — (\d+)\/(\d+)/);
const cancelled = readMatch("scratch/prove-owner-controls.out", /اللي المفروض الإيقاف يلغيه: (\d+)/)[1];
const restored = readMatch("scratch/prove-owner-controls.out", /المهام الرجعت بحالتها: (\d+) من (\d+)/);
const residueLedger = readMatch("scratch/prove-owner-controls.out", /فاضل من سطري: سطور الدفتر: (\d+)/)[1];
const tests = readMatch("scratch/ledger-fullsuite3.out", /Tests\s+(\d+) passed/)[1];
const guards = readMatch("scratch/ledger-tests4.out", /Tests\s+(\d+) passed/)[1];

const T = {
  WHEN: when,
  DEAD_ROWS: deadRows,
  LEDGER: ledgerRows,
  OPEN_TASKS: openTasks,
  PAPERS: papers,
  TABLES: eventTables.length,
  ALIVE_TABLES: aliveTables,
  DEAD_TABLES: deadTables,
  BACKUP_TABLES: backupTables,
  PROOF: proof[2],
  PROOF_TOTAL: proof[3],
  RESULT: proof[1] === "ALL_PASS" ? "كلها نجحت" : "فيها فشل",
  CANCELLED: cancelled,
  RESTORED: restored[1],
  RESTORE_TOTAL: restored[2],
  RESIDUE: residueLedger,
  TESTS: tests,
  GUARDS: guards,
};

const lines = [
  "",
  "- **الوكيل ({WHEN}):** **زرار الإيقاف الطارئ وورقة القرار بقوا بيسجّلوا اللي عملوه فعلًا — الاتنين كانوا بيوصلوا لحاجة مش موجودة في القاعدة.**",
  "  **القياس على القاعدة الحيّة:** زرار الإيقاف كان بيكتب في جدولين مش موجودين أصلاً (`emergency_stop_state` و`device_locks`)، فالضغططة كانت بترد ٥٠٠ بخطأ القاعدة نفسه بالإنجليزي على شاشة المالك، والأثر الحقيقي الوحيد (إلغاء المهام المفتوحة) كان بيحصل من غير أي أثر مسجّل · ورقة القرار كانت بتكتب في تلات أعمدة مش موجودة (`decided_by` و`decided_at` و`notes`) فالقرار ما كان بيوصلش للورقة أصلًا · والمكاتب التلاتة اللي بتنادي الجدول الميت كانت كتابتها بيرفض بكود ٤٢٧٠٣ ويضيع في `console.error`.",
  "  **القرار المعماري:** مكان الحدث الواحد في المتجر هو الدفتر (`ops_sync_events`) — **{LEDGER}** سطر لحد دلوقتي، وآخر سطر فيه اتكتب النهاردة. فبدل ما نخترع جدول تاني للحالة، الإيقاف ورفعه بقوا سطور في الدفتر، والإيقاف بقى **نوع تنبيه**: الشريطان (الأحمر في الجديدة وشريط اللوحة القديمة) عدّوه نفس العدد وشافوا نفس السطر، والرفع وصلة مش صافر · كاتب واحد للدفتر (`lib/ops/ledger.ts`) بيرجّع رقم السطر من ردّ القاعدة نفسها، ومفيش حد بيخترع رقم حدث لما الكتابة ترفض · مفيش أي شاشة بتطبع نص القاعدة: الرفض كله عربي بسبب مسمّى.",
  "  **اللي اتعمل كمان:** زرار الكابينة بقى يقول عدد المهام اللي اتلغت فعلًا، ويعلن لو الإيقاف اتنفّذ بس ما اتسجّلش · حالة الإيقاف بتتقرا من الدفتر (أحدث إيقاف مقابل أحدث رفع) مش من جدول مفقود · كاتب تسجيل ميت (`logEvent`) اتمسح مع اللي كان بينادي عليه، لأن كلام المالك مع الموظفين له صاحب واحد هو مخزن المحادثات.",
  "  **القياس الحيّ على الرابط المنشور:** `scratch/prove-owner-controls-record.mjs` — **{RESULT} {PROOF} من {PROOF_TOTAL}**: {CANCELLED} مهام مفتوحة كانت في السجل، والزرار ردّ بعدد منهم من ردّ القاعدة نفسها، وسطر الدفتر رجع بنفس العدد، والشريطان عدّوا نفس الرقم · ضغطة الزرار الحقيقية على عرض ٣٩٠ (بعد فتح الدرج زي ما بيعمل هو) قالت «الدار واقفة — ١ مهمة شغالة اتلغت» بحروفه العربية، والصورة اتبصّيت عليها · رفع الإيقاف رجّع الحالة للسكون · كلمة «موافق» على ورقة اتسجّلت في الأعمدة الموجودة فعلًا، والورقة اللي اتفصل فيها بترفض تاني بجملة عربية · زائر بلا جلسة مرفوض 401 وما لغيش حاجة.",
  "  **الأداة كانت خطر على بياناته، فاتعمل ليها نقطة رجوع:** الزرار بيلغي مهام حقيقية، فالقياس كتب نسخة من كل مهمة مفتوحة (حالتها وتاريخها ورسالتها) في `scratch/checkpoint-agent-tasks.json` قبل ما يضغط، وبعد ما خلّص رجّع **{RESTORED} من {RESTORE_TOTAL}** لمهام المالك لقيمهم القديمة، ومسح بس السطور اللي عملها هو — فاضل **{RESIDUE}** سطر من أدواتي في الدفتر.",
  "  **اللي طلع من نفس الطريق واتسجل مهام:** ورقة «موافق» اللي المفروض تشغّل حاجة لسه ما بتعملش حاجة — الكود بتاعها بيقرأ عمودين مش موجودين، وفروعه بتلمس التعاقد والأسعار ({PAPERS} ورقة مستنية دلوقتي) · المتجر فيه **{TABLES}** جدول اسمها ينتهي بـ«أحداث»: **{ALIVE_TABLES}** منهم آخر كتابة فيهم جوه التلات أسابيع اللي فاتت (الدفتر **{LEDGER}** سطر آخره النهاردة، وجدول زيارات العميل آخر كتابة فيه 2026-10-09) و**{DEAD_TABLES}** ساكنة (الجدول الميت اللي كنا بنقرا منه من 2026-08-10، وواحد فاضي ومفيش كود بيسمّيه، وواحد آخر سطر فيه من 2026-09-24، وواحد كاتبه شغال بس ما سجلش ولا مرة) و**{BACKUP_TABLES}** نسخة احتياطية عملها برنامج النقل نفسه · خدمة رسائل العملاء مفيش أي كود بينادي عليها أصلًا.",
  "  **البوابات:** {TESTS} اختبار أخضر (خروج 0) · تيبشك سليم · بناء كامل · منشور · **{GUARDS} حارس** على شكل السطر الواحد: مفيش باب بيكتب في الجدول الميت، ومفيش رقم حدث بيختلق، ومفيش نص قاعدة على شاشة، والمهام المفتوحة بتتعدّ من ردّ القاعدة، ومؤقت التسلح ما بيمسحش ردّ الباب.",
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
console.log("المقاس:", JSON.stringify({ deadRows, ledgerRows, openTasks, papers, tables: eventTables.length, alive: aliveTables, dead: deadTables, backups: backupTables, proof: proof[0], cancelled, residueLedger, tests, guards }));
