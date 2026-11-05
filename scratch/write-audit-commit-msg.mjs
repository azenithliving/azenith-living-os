import fs from "node:fs";
import { execFileSync } from "node:child_process";

const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const tests = stripAnsi(fs.readFileSync("scratch/audit-fullsuite2.out", "utf8"));
const build = stripAnsi(fs.readFileSync("scratch/audit-build.out", "utf8"));
const write = stripAnsi(fs.readFileSync("scratch/measure-audit-write.out", "utf8"));

const num = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return Number(m[1]);
};

const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests passed");
const gates = stripAnsi(fs.readFileSync("scratch/audit-gates.out", "utf8"));
if (num(/TSC_EXIT=(\d+)/, gates, "tsc exit") !== 0) throw new Error("tsc did not pass");
const BUILD_EXIT = num(/BUILD_EXIT=(\d+)/, gates, "build exit");
if (BUILD_EXIT !== 0) throw new Error("the build did not pass");
const ROWS_BEFORE = num(/^rows before=(\d+)/m, write, "audit rows before");
const REFUSAL = (write.match(/^LEGACY_INSERT ok=true/m) ?? []).length;
if (REFUSAL !== 1) throw new Error("the record's own answer was not measured");

const auditSource = fs.readFileSync("lib/ops/audit-record.ts", "utf8");
const COLUMNS = (auditSource.match(/"([a-z_]+)"/g) ?? []).length;
const WRITE_LIST = (auditSource.match(/AUDIT_WRITE_COLUMNS\s*=\s*\[([\s\S]*?)\]/) ?? [])[1] ?? "";
const AUDIT_COLUMNS = (WRITE_LIST.match(/"([a-z_]+)"/g) ?? []).length;

const guardSource = fs.readFileSync("tests/ops/auditOneWriter.test.ts", "utf8");
const GUARDS = (guardSource.match(/^\s*it\(/gm) ?? []).length;

const callers = execFileSync("grep", ["-rc", "await logAuditEvent(", "lib/agent-tools/approval-system.ts", "lib/real-tool-executor.ts", "lib/seo-analyzer.ts", "lib/ultimate-agent/executor-omnipotent.ts", "app/api/admin/agent/rollback/route.ts", "app/api/admin/agent/tools/execute/route.ts", "app/api/admin/agent/ultimate/route.ts"], { encoding: "utf8" });
const callerFiles = callers.trim().split("\n");
const SITES = callerFiles.reduce((sum, line) => sum + Number(line.split(":").pop()), 0);
const FILES = callerFiles.length;

const T = { TESTS, ROWS_BEFORE, AUDIT_COLUMNS, GUARDS, SITES, FILES };

const lines = [
  "سجل الأحداث بقى له باب واحد بيسمع الرفض الصح — القياس قال إن الجدول كان فاضي (**{ROWS_BEFORE}** سطر) و**{SITES}** موضع استدعاء في **{FILES}** ملفات بيكتبوا فيه · الباب القديم كان بيبعت أسماء أعمدة السجل ما عندهاش، ولسّه كود الرفض الغلط: رفض اسم في بيانات الكتابة بيجي بكود، ورفض اسم في قراءة بيجي بكود تاني، فالإعادة ما كانش لها فرصة تحصل، والرفض كان بيترمى من غير ما حد يسمعه",
  "الباب الجديد بيبعت الأعمدة (**{AUDIT_COLUMNS}**) اللي السجل بيعرفها بس، وبيسترجع رقم السطر، ولو السجل ما رجّعتش رقم بيقول «ما اتسجّلش» · وشركة المتجر والفاعل والورقة المرتبطة بيهم بقى راكبين جوه عمود البيانات اللي السجل بيعرفه، فالوصلة اتفضلت بدل ما تتقطع",
  "الحدس نفسه اتمسح من كاتب الورق المستني: تلات أعمدة عنده فعلًا في السجل، فالفرع اللي كان بيشيلها كان ميتًا لو اشتغل كان بيشيل وصلة حقيقية",
  "اللي طلع من نفس القياس واتسجل مهمة: باب الخزنة بيسجّل كود استرجاع اتستخدم في جدول مش موجود أصلًا، والرفض بيرجع كقيمة فالسجل ما بيكتبش والباب بيكمل عادي",
  "البوابات: **{TESTS}** اختبار أخضر · تيبشك سليم · بناء كامل (خروج صفر) · **{GUARDS} حراس** على الباب الواحد، منهم واحد بيثبت إن مفيش ملف تاني بيكتب في الجدول، وواحد بيثبت إن الحدس بكود الرفض اتمسح",
];

const toArabic = (s) =>
  s.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d))).replace(/,/g, "٬");

const body = lines
  .map((l) => l.replace(/\{([A-Z_0-9]+)\}/g, (_, k) => String(T[k])))
  .map(toArabic)
  .join("\n\n");

const allowed = Object.values(T).map(String).join("");
const words = (body.match(/[A-Za-z]{2,}/g) ?? []).filter((w) => !allowed.toLowerCase().includes(w.toLowerCase()));
if (words.length) throw new Error("Latin words leaked: " + words.join(", "));
const strays = (body.match(/[0-9]+/g) ?? []).filter((r) => !allowed.includes(r));
if (strays.length) throw new Error("Latin digits outside the tokens: " + strays.join(", "));
if (/[\u0590-\u05ff\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/.test(body)) throw new Error("a non-Arabic script leaked");
if (/\{[A-Z_0-9]+\}/.test(body)) throw new Error("an unreplaced token survived");
if (body.includes("undefined") || body.includes("NaN")) throw new Error("a token had no measured value");

fs.writeFileSync("scratch/commit-msg.txt", "fix(audit): " + body + "\n", "utf8");
console.log("المقاس:", JSON.stringify(T));
