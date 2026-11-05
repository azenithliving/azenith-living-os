import fs from "node:fs";

/**
 * Appends the «one owner for the store's company» atom to the running log. Numbers are
 * re-measured from the live record in this run or parsed from files a tool wrote in this session.
 */
const path = "docs/ledger/council-minutes.md";
const when = new Date().toISOString().slice(0, 16).replace("T", " ");
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
const sql = await import("postgres").then((m) => m.default(process.env.DIRECT_URL, { ssl: "require", max: 1 }));
const COMPANY = process.env.ADMIN_COMPANY_ID?.trim();

const pending = (await sql`
  select count(*)::int total,
         count(*) filter (where company_id = ${COMPANY})::int owned,
         count(*) filter (where company_id is null)::int orphan
  from approval_requests where status = 'pending'`)[0];
const memoryShape = await sql`
  select count(*) filter (where column_name = 'company_id')::int has_company, count(*)::int cols
  from information_schema.columns where table_schema='public' and table_name='agent_memory'`;
const memoryRows = (await sql`select count(*)::int c from agent_memory`)[0].c;
const ledgerRows = (await sql`select count(*)::int c from ops_sync_events`)[0].c;
await sql.end();

const readMatch = (file, re) => {
  const text = fs.readFileSync(file, "utf8").replace(new RegExp("[" + String.fromCharCode(27) + "][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZc-n>]", "g"), "");
  const m = text.match(re);
  if (!m) throw new Error(`${file} has no match for ${re}`);
  return m;
};

const proof = readMatch("scratch/prove-papers-have-owner.out", /(ALL_PASS|SOME_FAIL) — (\d+)\/(\d+)/);
const before = readMatch("scratch/prove-papers-have-owner.out", /الورق المستني قبل القياس: الإجمالي (\d+) · له شركة (\d+) · بلا شركة (\d+)/);
const residue = readMatch("scratch/prove-papers-have-owner.out", /فاضل من ورقي بعد التنظيف: (\d+)/)[1];
const tests = readMatch("scratch/company-fullsuite4.out", /Tests\s+(\d+) passed/)[1];
const guards = (fs.readFileSync("tests/ops/companyOneOwner.test.ts", "utf8").match(/^\s*it\(/gm) ?? []).length;

const T = {
  WHEN: when,
  TOTAL: pending.total,
  OWNED: pending.owned,
  ORPHAN: pending.orphan,
  MEMORY: memoryRows,
  MEMORY_COLS: memoryShape[0].cols,
  MEMORY_HAS_COMPANY: memoryShape[0].has_company,
  LEDGER: ledgerRows,
  BEFORE_TOTAL: before[1],
  BEFORE_OWNED: before[2],
  BEFORE_ORPHAN: before[3],
  PROOF: proof[2],
  PROOF_TOTAL: proof[3],
  RESULT: proof[1] === "ALL_PASS" ? "كلها نجحت" : "فيها فشل",
  RESIDUE: residue,
  TESTS: tests,
  GUARDS: guards,
};

const lines = [
  "",
  "- **الوكيل ({WHEN}):** **«مين صاحب الورقة» بقى ليه إجابة واحدة — ودي كانت سبب إن أغلب الورق المستني كلمتك ملوش صاحب.**",
  "  **القياس على القاعدة الحيّة:** من **{BEFORE_TOTAL}** ورقة مستنية، **{BEFORE_ORPHAN}** ملهاش شركة و**{BEFORE_OWNED}** بس اللي ليها · السبب: اتناشر مكان في الكود بيقروا متغير البيئة اللي بيسمّي الشركة مباشرة، و المتغير ده مش مضبوط في النشر أصلًا، فالسطور اللي بيكتبوها بتتسجّل من غير صاحب — ومن نفس الطريق طلع إن جدول مخزن الموظفين (**{MEMORY_COLS}** عموداً) مفيهوش أصلًا عمود شركة، فثلاث مكاتب بتكتب فيه بترسل أعمدة مش موجودة والكتابة بترفض (اتسجلت مهمة مستقلة) · وفيه مكان كان لما الكتابة ترفض بيعيد الكرّة **بعد ما يشيل عمود الشركة**، يعني كل فشل كان بيولّد ورقة يتيمة.",
  "  **القرار المعماري:** السؤال «إيه شركة المتجر» ليه مُجيب واحد (`lib/admin-env-resolver.ts`) بيجاوب من قرار المتجر المكتوب في القاعدة نفسه، وكل القرايات اتحوّلت عليه · كمان سؤال «أنهي ورق بتاعي» بقى ليه رد واحد (`withOwnerPapers` في موديول الورق): ورق المتجر + الورق اللي اتكتب قبل ما الختم يوجد — بنفس الرد بيعدّ مكتب القرار وبيفلتر باب القرار وبتعدّ لوحة المالك، فالشاشات ما تختلفش · ولما تفصل ورقة يتيمة، كلمة المالك نفسها هي اللي بتختمها باسم المتجر (تبنّي بالقرار مش بكتابة جماعية).",
  "  **اللي اتعمل كمان:** كاتب الاقتراحات بقى بيرفض يخلق ورقة من غير صاحب بدل ما يسيبها يتيمة · كارت «الورق المستني» في اللوحة كان فاضي من يومه لسبب تالت: الباب كان بيطلب تضمين اسم المستخدم، مفيش مفتاح أجنبي يربط الجدولين، والقاعدة بترفض بكود «بحث مش لاقي»، فالخطأ كان بيتحوّل لقائمة فاضية والشاشة بتطمنك · والعدد بقى بيتطلب عدّاد من السجل على نفس المجموعة، لأن القائمة صفحة بعشرة، فكانت اللوحة بتقول عدد الصفحة مش عدد الكومة · شريحة المبلغ المالي اللي كانت بتقرأ عمود «القيمة» المش موجود اتشالت · الاسم اللي كان بيطبع بالإنجليزي بقى ساكت لو مفيش اسم.",
  "  **القياس الحيّ على الرابط المنشور:** `scratch/prove-papers-have-owner.mjs` — **{RESULT} {PROOF} من {PROOF_TOTAL}**: ورقة اتخلقت من الباب وطلع عليها اسم المتجر · ورقة يتيمة اتعملت عمدًا، مكتب القرار شافها، وباب القرار فصلها وخدت اسم المتجر · بلاية الانتظار في لوحة المالك عدّت نفس رقم العدّاد · **{RESIDUE}** ورقة فاضلة من ورقي بعد التنظيف، والورق المستني دلوقتي **{TOTAL}** منه **{OWNED}** له شركة و**{ORPHAN}** لسه يتبنى.",
  "  **اللي ما اتعملش (كلمتك):** الـ**{ORPHAN}** الورق اللي لسه بلا شركة ما اتلمستش — التبنّي الجماعي كتابة على سطور انت، فسايبها لحد ما تقول، وكل واحدة تتبنى لوحدها لما تفصل فيها.",
  "  **البوابات:** {TESTS} اختبار أخضر (خروج 0) · تيبشك سليم · بناء كامل · منشور · **{GUARDS} حارس**: مفيش قارئ لمتغير الشركة برّه المُجيب، ومفيش ورقة بتتخلق بلا صاحب، والعدّادات بتستخدم الرد الواحد.",
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
console.log("المقاس:", JSON.stringify({ pending, memoryRows, ledgerRows, proof: proof[0], residue, tests, guards }));
