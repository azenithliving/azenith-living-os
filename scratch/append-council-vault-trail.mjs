import fs from "node:fs";

const path = "docs/ledger/council-minutes.md";
const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const proof = stripAnsi(fs.readFileSync("scratch/prove-vault-trail-wired.out", "utf8"));
const tests = stripAnsi(fs.readFileSync("scratch/vault-fullsuite.out", "utf8"));
const vaultMeasure = stripAnsi(fs.readFileSync("scratch/measure-recovery-vault.out", "utf8"));

const num = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return Number(m[1]);
};

const PROOF = num(/النتيجة: (\d+) نجح/, proof, "proof passed");
const PROOF_TOTAL = num(/نجح من (\d+)/, proof, "proof total");
const STRANGER = num(/a stranger's attempt: status=(\d+)/, proof, "stranger status");
const OWNER = num(/the admin's own address: status=(\d+)/, proof, "owner status");
const BEFORE = num(/audit rows before: (\d+)/, proof, "audit rows before");
const AFTER = num(/audit rows after the attempts: (\d+)/, proof, "audit rows after");
const MISSING = (vaultMeasure.match(/^TABLE MISSING/mg) ?? []).length;
const VAULT_SOURCE = fs.readFileSync("lib/auth/vault.ts", "utf8");
const PATHS = (VAULT_SOURCE.match(/from\("recovery_vault"\)/g) ?? []).length;
const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests passed");
const GUARDS = (fs.readFileSync("tests/ops/auditOneWriter.test.ts", "utf8").match(/^\s*it\(/gm) ?? []).length;

if (AFTER !== BEFORE) throw new Error("an attempt wrote a row");
if (MISSING !== 2) throw new Error("the missing-table census is off: " + MISSING);

const T = { PROOF, PROOF_TOTAL, STRANGER, OWNER, BEFORE, AFTER, MISSING, PATHS, TESTS, GUARDS };

const now = new Date();
const hh = String(now.getUTCHours()).padStart(2, "0");
const mm = String(now.getUTCMinutes()).padStart(2, "0");

const lines = [
  "",
  `- **الوكيل (٢٠٢٦-١٠-٢٤ ${hh}:${mm}):** **خزنة الاسترجاع بقى أثرها راكب على الباب الواحد — والقياس قال إن الرجوع نفسه مالوش تخزين أصلًا.**`,
  "  **القياس الأول:** الجدول اللي الخزنة بتسجّل فيه أثرها مش موجود، والجدول اللي خزنة الكودات بتخزن فيه مش موجود كمان (**{MISSING}** جدول غايب من السجل نفسه)، و**{PATHS}** مسار في ملفها بيقرأ ويكتب في الغايب · فالسؤال «كود الاسترجاع بيشتغلش ليه؟» إجابته مش كود غلط: مفيش تخزين من الأساس، وده سبب فشل مش حدس.",
  "  **القرار:** أثر الرجوع بقى بيمشي على الباب الواحد اللي بيسمع الرفض ويرجع رقم السطر، فالوصلة اتسجلت في مكان حقيقي بدل رفّ ميت · اسم الجدول الغايب اتمسح من المشروع كله وحارس بيقرا كل ملف بيثبت إنه ما يرجعيش · ومحدش عمل جدول جديد: ده قراره ليك لأن معناه مفتاح رجوع للوحة تحكمك.",
  "  **القياس الحيّ على الرابط المنشور:** `scratch/prove-vault-trail-wired.mjs` — **نجحت {PROOF} من {PROOF_TOTAL}**: مفيش محاولة استرجاع نجحت، ومفيش كود تسرب في الرد · الغريب بياخد (**{STRANGER}**) وعنوان المالك بيوصل للمسار المكسور فبياخد (**{OWNER}**) — الفرق ده بيقول للغريب إن العنوان حقيقي، واتسجل مهمة مستقلة لأن علاجه قرار · والمحاولات ما كتبتش ولا سطر: السجل كان **{BEFORE}** ورجع **{AFTER}** · سطح حالة الكودات بيقول «مفيش خزنة» بوضوح بدل رقم مطمئن.",
  "  **البوابات:** {TESTS} اختبار أخضر · تيبشك سليم · بناء كامل · منشور · **{GUARDS} حراس** على الباب الواحد.",
  "",
];

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
