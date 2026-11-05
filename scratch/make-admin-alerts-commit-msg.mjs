/**
 * make-admin-alerts-commit-msg.mjs — the commit line, only from numbers a tool printed this run.
 *
 * Measures the page twice with the same rig (the committed copy and the repaired one), and reads
 * the live evidence taken from the published site before this repair could land.
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

const ESC = String.fromCharCode(27);
const plain = (s) => s.replace(new RegExp(ESC + "\\[[0-9;]*m", "g"), "");
const AR = (n) => String(n).replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));
const opts = { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 };

fs.writeFileSync("scratch/admin-home-before.tsx", execSync("git show HEAD:app/admin/page.tsx", opts), "utf8");

const before = plain(
  execSync("node scratch/measure-admin-alerts.mjs", {
    ...opts,
    env: { ...process.env, PAGE_FILE: "scratch/admin-home-before.tsx", NO_RECORD: "1", PAGE_OUT: "scratch/admin-alerts-before.out" },
  }),
);
const after = plain(execSync("node scratch/measure-admin-alerts.mjs", opts));
const live = plain(fs.readFileSync("scratch/admin-alerts-before-live.out", "utf8"));
const suite = plain(fs.readFileSync("scratch/admin-fullsuite.out", "utf8"));

function token(log, re, label) {
  const m = re.exec(log);
  if (!m) throw new Error("no measured value for " + label);
  return m[1];
}

const B = {
  rule: token(before, /PAGE_READS_THE_ONE_ALERT_RULE=(\w+)/, "before reads rule"),
  empty: token(before, /PAGE_ALERT_EMPTY_LINE=([^\n]+)/, "before empty line"),
  typed: token(before, /PAGE_TYPED_LATIN_DIGITS=(\d+)/, "before typed digits"),
  raw: token(before, /PAGE_RAW_INTERPOLATED_NUMBERS=(\d+)/, "before raw interpolations"),
  hidden: token(before, /PAGE_PRINTS_HOW_MANY_ARE_HIDDEN=(\w+)/, "before hidden count"),
  slice: token(before, /PAGE_SLICES_ALERTS_TO=(\d+)/, "before slice"),
  sources: token(before, /PAGE_ALERT_NAMED_SOURCES=(\d+)/, "before named sources"),
};

const A = {
  rule: token(after, /PAGE_READS_THE_ONE_ALERT_RULE=(\w+)/, "after reads rule"),
  empty: token(after, /PAGE_ALERT_EMPTY_LINE=([^\n]+)/, "after empty line"),
  typed: token(after, /PAGE_TYPED_LATIN_DIGITS=(\d+)/, "after typed digits"),
  raw: token(after, /PAGE_RAW_INTERPOLATED_NUMBERS=(\d+)/, "after raw interpolations"),
  hidden: token(after, /PAGE_PRINTS_HOW_MANY_ARE_HIDDEN=(\w+)/, "after hidden count"),
  sources: token(after, /PAGE_ALERT_NAMED_SOURCES=(\d+)/, "after named sources"),
  types: token(after, /^RULE_EVENT_TYPES=(\d+)/m, "rule event types"),
  windowMin: Math.round(Number(token(after, /WINDOW_MS=(\d+)/, "rule window")) / 60000),
  tableCols: token(after, /FAILED_LOGIN_TABLE_COLUMNS=(\d+)/, "attempts table columns"),
  phantom: token(after, /FAILED_LOGIN_QUERY_NAMES_WHAT_THE_TABLE_HASNT=(\d+)/, "phantom filter columns"),
  saCols: token(after, /SYSTEM_ALERTS_COLUMNS=(\d+)/, "watcher table columns"),
  ledgerTotal: token(after, /LEDGER_TOTAL_ROWS=(\d+)/, "ledger rows"),
};

const L = {
  warnings: token(live, /MASTERMIND_WARNINGS=(\d+)/, "live door warnings"),
  warningBytes: token(live, /MASTERMIND_WARNINGS=\d+ :: ([^|\n]+)/, "live warning").trim().length,
  named: token(live, /ATTEMPTS_REFUSAL_NAMED=(\w+)/, "refusal named"),
  doorCount: token(live, /MASTERMIND_FAILED_ATTEMPTS_24H=(\d+)/, "door count"),
  watchPending: token(live, /"pending":(\d+)/, "watcher pending"),
  cardBytes: token(live, /"bytes":(\d+)/, "card bytes"),
  cardLatin: token(live, /"latinDigits":(\d+)/, "card latin digits"),
  oldSub: token(live, /"requiresAttention":(\w+)/, "old subtitle"),
};

const TESTS = token(suite, /Tests\s+(\d+) passed/, "tests passed");
const GUARDS = (fs.readFileSync("tests/ops/alertStripOneOwner.test.ts", "utf8").match(/^\s*it\(/gm) ?? []).length;

if (B.rule !== "false" || A.rule !== "true") throw new Error("the page's read did not change");
if (B.typed === "0" && B.raw === "0") throw new Error("the before-reading shows no digit defect");
if (A.typed !== "0" || A.raw !== "0") throw new Error("digits are still raw: " + A.typed + "/" + A.raw);
if (A.empty !== "none" || B.empty === "none") throw new Error("the invented empty line is still there");
if (A.sources < 3 || B.sources !== "0") throw new Error("the sources are not named: " + B.sources + " -> " + A.sources);
if (L.named !== "yes") throw new Error("the published door did not show the refusal");

const msg =
  "fix(alerts): صفحة التحكم القديمة بقى بتقرأ تنبيهات المتجر من بابها — والسطر اللي ما كانش بيردّ اتسمّى سببه" +
  "\n\n" +
  `القياس على الملفين بنفس المِقياس: قاعدة التنبيهات بتعرف ${AR(A.types)} نوع حدث و نافذة ${AR(A.windowMin)} دقيقة، والصفحة ما كانتش بتقرأ الباب اللي بيمرّ منهم · ` +
  `كانت بتولّع السطور من مصدرين بس ومن غير ما تسمّي مين قالهم (${AR(B.sources)} مصدر مسمّى على الشاشة)، وبتطبع سطر «${B.empty.trim()}» من عندها، ` +
  `وبتقطع عند ${AR(B.slice)} من غير ما تعدّ اللي فاضل · وفي نصها العربي ${AR(B.typed)} رقم مكتوب لاتيني و${AR(B.raw)} رقم بيمرّ زي ما هو` +
  "\n\n" +
  `وعلى الرابط المنشور قبل ما التنقيط ده يوصل: الباب ردّ بـ${AR(L.warnings)} رفض، ${AR(L.warningBytes)} حرف، وسماّه — ` +
  `الاستعلام كان بيفلتر جدول محاولات الدخول على عمود الشركة، والجدول يردّ على ${AR(A.tableCols)} عمود بس ومفيش فيهم عمود شركة، ` +
  `فالرفض ده معناه إن سطر الأمان ما كانش يقدر يظهر أبداً والعدد ساكن صفر (${AR(L.doorCount)}) · والصفحة كانت بتتجاهل الرفض اللي الباب ببعته` +
  "\n\n" +
  `الإصلاح: الصفحة بقت تقرأ الدفتر من الباب نفسه اللي الكابينة واللوحة والجرس بيقروا منه، وكل سطر بقى مكتوب عليه مين قاله ` +
  `(${AR(A.sources)} مصدر مسمّى: الدفتر والفحص وبوابة الدخول)، وسطر «مفيش تنبيهات» بقى جملة الباب اللي بتسمّي النافذة، ` +
  `واللي بيتخبي بقى بيتعدّ، والأرقام بقت بحروفه (${AR(A.typed)} رقم مكتوب و${AR(A.raw)} رقم بيمرّ زي ما هو) · ` +
  `وفلتر العمود اللي مالوش وجود اتشال من الباب فبقى العدد قياس فعلاً (${AR(A.phantom)} عمود وهمي فاضل)` +
  "\n\n" +
  `وعلى نفس القياس من النسخة الحيّة: جدول الفحص عنده ${AR(A.saCols)} عمود وفيه ${AR(L.watchPending)} تنبيه مفتوح دلوقتي، والدفتر فيه ${AR(A.ledgerTotal)} سطر · ` +
  `الكارت كان بيعرض ${AR(L.cardBytes)} حرف بـ${AR(L.cardLatin)} رقم لاتيني، وتحت عنوان قديم بيقول «تنبيهات تتطلب الانتباه»`;

const prose = msg.replace(/^fix\([a-z]+\): /, "");
const latin = (prose.match(/[A-Za-z]{4,}/g) ?? []).filter((w) => w !== "dal");
if (latin.length) throw new Error("Latin words leaked: " + latin.join(", "));
if (/[0-9]/.test(prose)) throw new Error("Latin digits leaked");
if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\u0590-\u05ff]/.test(msg)) throw new Error("a non-Arabic script leaked");
if (msg.includes("undefined") || msg.includes("NaN")) throw new Error("a token had no measured value");

const full = msg + `\n\nالبوابات: ${AR(TESTS)} اختبار أخضر · تيبشك سليم · بناء كامل · ${AR(GUARDS)} حارس في ملف التنبيهات`;
fs.writeFileSync("scratch/commit-msg.txt", full, "utf8");
console.log("before:", JSON.stringify(B));
console.log("after:", JSON.stringify(A));
console.log("live:", JSON.stringify(L));
console.log("---");
console.log(full);
