import fs from "node:fs";
import { execFileSync } from "node:child_process";

const path = "docs/ledger/council-minutes.md";
const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const proof = stripAnsi(fs.readFileSync("scratch/prove-audit-lands.out", "utf8"));
const tests = stripAnsi(fs.readFileSync("scratch/audit-fullsuite2.out", "utf8"));
const write = stripAnsi(fs.readFileSync("scratch/measure-audit-write.out", "utf8"));
const guardSource = fs.readFileSync("tests/ops/auditOneWriter.test.ts", "utf8");

const num = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return Number(m[1]);
};

const PROOF = num(/النتيجة: (\d+) نجح/, proof, "proof passed");
const PROOF_TOTAL = num(/نجح من (\d+)/, proof, "proof total");
const LANDED = num(/rows carrying this instrument's marker: (\d+)/, proof, "landed rows");
const CARD = num(/the security stats card counts: (\d+)/, proof, "card count");
const RECORD = num(/the record itself holds: (\d+)/, proof, "record count");
const LEFT = num(/my rows left: (\d+)/, proof, "leftover rows");
const AFTER = num(/rows after cleanup: (\d+)/, proof, "rows after");
const BOARD_CHARS = num(/board characters: (\d+)/, proof, "board characters");
const ROWS_BEFORE = num(/^rows before=(\d+)/m, write, "rows before");
const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests passed");
const GUARDS = (guardSource.match(/^\s*it\(/gm) ?? []).length;

const auditSource = fs.readFileSync("lib/ops/audit-record.ts", "utf8");
const AUDIT_COLUMNS = ((auditSource.match(/AUDIT_WRITE_COLUMNS\s*=\s*\[([\s\S]*?)\]/) ?? [])[1] ?? "").match(/"[a-z_]+"/g)?.length;
if (!AUDIT_COLUMNS) throw new Error("missing measurement: the writer's column list");

const callers = execFileSync(
  "grep",
  [
    "-c",
    "await logAuditEvent(",
    "lib/agent-tools/approval-system.ts",
    "lib/real-tool-executor.ts",
    "lib/seo-analyzer.ts",
    "lib/ultimate-agent/executor-omnipotent.ts",
    "app/api/admin/agent/rollback/route.ts",
    "app/api/admin/agent/tools/execute/route.ts",
    "app/api/admin/agent/ultimate/route.ts",
  ],
  { encoding: "utf8" },
);
const callerFiles = callers.trim().split("\n");
const FILES = callerFiles.length;
const SITES = callerFiles.reduce((sum, line) => sum + Number(line.split(":").pop()), 0);

if (PROOF !== PROOF_TOTAL) throw new Error("the live proof is not complete");
if (LANDED !== 1 || CARD !== 1 || RECORD !== 1) throw new Error("the audit row did not land on both paths");
if (LEFT !== 0 || AFTER !== ROWS_BEFORE) throw new Error("the instrument left a row behind");

const T = { PROOF, PROOF_TOTAL, LANDED, CARD, RECORD, LEFT, AFTER, BOARD_CHARS, ROWS_BEFORE, TESTS, GUARDS, SITES, FILES, AUDIT_COLUMNS };

const now = new Date();
const hh = String(now.getUTCHours()).padStart(2, "0");
const mm = String(now.getUTCMinutes()).padStart(2, "0");

const lines = [
  "",
  `- **الوكيل (٢٠٢٦-١٠-٢٤ ${hh}:${mm}):** **سجل الأحداث بقى له باب واحد بيسمع الرفض الصح، وأول سطر اتسجّل فعلًا على الرابط المنشور.**`,
  "  **القياس الأول:** الجدول كان فاضي (**{ROWS_BEFORE}** سطر) و**{SITES}** موضع استدعاء في **{FILES}** ملفات بيكتبوا فيه · السبب: الباب القديم بيبعت أسماء أعمدة السجل ما عندهاش، وبيسمع لكود رفض القراءة `42703` بينما رفض اسم جوه بيانات الكتابة بيجي بكود تاني `PGRST204` — فالمحاولة التانية ما كانش لها فرصة تحصل، والرفض اترمى من غير ما حد يسمعه (القياس على السجل الحيّ: الرفض الأول مرفوض، والتاني بدون الأسماء المخترعة بينجح ويرجع سطره).",
  "  **القرار المعماري:** الباب الجديد بيبعت الأعمدة **{AUDIT_COLUMNS}** اللي السجل بيعرفها، بيسترجع رقم السطر، ولو ما رجعش رقم بيقول «ما اتسجّلش» · وصلات الشركة والفاعل والورقة راكبة جوه عمود البيانات اللي السجل بيعرفه، فالوصلة اتفضلت بدل ما تتقطع أو تتخترع لها أعمدة · والحدس نفسه اتمسح من كاتب الورق المستني: أعمدته التلاتة موجودة فعلًا في السجل، فالفرع كان ميتًا ولو اشتغل كان بيشيل وصلة حقيقية.",
  "  **القياس الحيّ على الرابط المنشور:** `scratch/prove-audit-lands.mjs` — **نجحت {PROOF} من {PROOF_TOTAL}**: باب الأوامر الحقيقي كتب حدث، والسطر طلع من السجل بنوعه وفاعله ونتيجته والوصلتين جوه بياناته (سطر واحد اتسجّل) · كارت إحصيات الأمان بقى بيعدّ **{CARD}** والجدول نفسه **{RECORD}** بعد ما كان صفر دائم · الأداة مسحت سطورها بعلامتها نفسها: فاضل **{LEFT}** وعدد الجدول رجع **{AFTER}** · لوحة المالك فتحت على عرض ٣٩٠ من غير خطأ كونسول (**{BOARD_CHARS}** حرف)، والصورتين اتبصّ عليهم.",
  "  **اللي طلع من نفس القياس واتسجل مهمة:** باب الخزنة بيسجّل كود استرجاع اتستخدم في جدول مش موجود أصلًا، والرفض بيرجع كقيمة فالسجل ما بيكتبش والباب بيكمل عادي — قراره محتاج كلمة: يركب على الباب الواحد ولا الجدول يتعمل.",
  "  **البوابات:** {TESTS} اختبار أخضر · تيبشك سليم · بناء كامل · منشور · **{GUARDS} حراس** على الباب الواحد، منهم واحد بيثبت إن مفيش ملف تاني بيكتب في الجدول.",
  "",
];

// Digits become his digits, but a machine code inside backticks keeps the exact shape it has.
const toArabic = (s) =>
  s.replace(/`[^`]*`|[^`]+/g, (chunk) =>
    chunk.startsWith("`")
      ? chunk
      : chunk.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬"),
  );

const body = lines
  .map((l) => l.replace(/\{([A-Z_0-9]+)\}/g, (_, k) => String(T[k])))
  .map(toArabic)
  .join("\n");

const allowed = Object.values(T).map(String).join("");
const prose = body.replace(/`[^`]*`/g, "");
const strays = (prose.match(/[0-9]+/g) ?? []).filter((r) => !allowed.includes(r));
if (strays.length) throw new Error("Latin digits outside the tokens: " + strays.join(", "));
const words = (prose.match(/[A-Za-z]{3,}/g) ?? []).filter((w) => !allowed.toLowerCase().includes(w.toLowerCase()));
if (words.length) throw new Error("Latin words leaked: " + words.join(", "));
if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\u0590-\u05ff]/.test(body)) throw new Error("a non-Arabic script leaked into the prose");
if (/\{[A-Z_0-9]+\}/.test(body)) throw new Error("an unreplaced token survived");
if (body.includes("undefined") || body.includes("NaN")) throw new Error("a token had no measured value");

fs.appendFileSync(path, body, "utf8");
console.log("appended lines:", body.split("\n").length - 2);
console.log("المقاس:", JSON.stringify(T));
