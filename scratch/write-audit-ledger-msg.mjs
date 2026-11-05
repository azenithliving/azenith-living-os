import fs from "node:fs";
import { execFileSync } from "node:child_process";

const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const proof = stripAnsi(fs.readFileSync("scratch/prove-audit-lands.out", "utf8"));
const tests = stripAnsi(fs.readFileSync("scratch/audit-fullsuite2.out", "utf8"));

const num = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return Number(m[1]);
};

const PROOF = num(/النتيجة: (\d+) نجح/, proof, "proof passed");
const PROOF_TOTAL = num(/نجح من (\d+)/, proof, "proof total");
const CARD = num(/the security stats card counts: (\d+)/, proof, "card count");
const LEFT = num(/my rows left: (\d+)/, proof, "leftovers");
const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests");
const guardSource = fs.readFileSync("tests/ops/auditOneWriter.test.ts", "utf8");
const GUARDS = (guardSource.match(/^\s*it\(/gm) ?? []).length;
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
const SITES = callers
  .trim()
  .split("\n")
  .reduce((sum, line) => sum + Number(line.split(":").pop()), 0);

const T = { PROOF, PROOF_TOTAL, CARD, LEFT, TESTS, GUARDS, SITES };

const body =
  "docs(ledger): سطر سجل الأحداث بقى له باب واحد اتقاس ونُشر — القياس قال إن الجدول كان فاضي صفر سطر و**{SITES}** موضع استدعاء بيكتبوا فيه، والسبب إن الكاتب كان بيسمع لكود رفض القراءة بينما رفض الكتابة بيجي بكود تاني، فالمحاولة التانية ما كانش لها فرصة والرفض كان بيترمى · الباب الجديد بيبعت أعمدة السجل بس، بيسترجع رقم السطر، والوصلات راكبة جوه عمود البيانات · الدليل الحيّ **{PROOF}** من **{PROOF_TOTAL}**: باب الأوامر كتب والسطر طلع، وكارت الإحصيات بقى بيعدّ **{CARD}** بدل صفر دائم، والأداة مسحت سطورها بعلامتها (فاضل **{LEFT}**) · **{TESTS}** اختبار · **{GUARDS}** حراس";

const filled = body
  .replace(/\{([A-Z_0-9]+)\}/g, (_, k) => String(T[k] ?? "undefined"))
  .replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));

const allowed = Object.values(T).map(String).join("");
const prose = filled.replace(/^docs\(ledger\):\s*/, "");
const words = (prose.match(/[A-Za-z]{2,}/g) ?? []).filter((w) => !allowed.toLowerCase().includes(w.toLowerCase()));
if (words.length) throw new Error("Latin words leaked: " + words.join(", "));
if (/[0-9]/.test(filled)) throw new Error("a Latin digit survived");
if (filled.includes("undefined") || filled.includes("NaN")) throw new Error("a token had no measured value");

fs.writeFileSync("scratch/commit-msg.txt", filled + "\n", "utf8");
console.log("المقاس:", JSON.stringify(T));
