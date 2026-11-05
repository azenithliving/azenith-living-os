/**
 * make-bell-commit-msg.mjs — the commit line, built only from numbers this run printed.
 *
 * Measures the bell twice with the same rig: the copy in the last commit (the before) and the
 * repaired file (the after), then refuses to write a message when any token has no measured
 * value behind it.
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

const plain = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const AR = (n) => String(n).replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));
const MONTHS = {
  Jan: "يناير", Feb: "فبراير", Mar: "مارس", Apr: "أبريل", May: "مايو", Jun: "يونيو",
  Jul: "يوليو", Aug: "أغسطس", Sep: "سبتمبر", Oct: "أكتوبر", Nov: "نوفمبر", Dec: "ديسمبر",
};

const opts = { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 };
fs.writeFileSync("scratch/bell-before.tsx", execSync("git show HEAD:components/admin/NotificationBell.tsx", opts), "utf8");

const before = plain(
  execSync("node scratch/measure-bell-contract.mjs", {
    ...opts,
    env: { ...process.env, BELL_FILE: "scratch/bell-before.tsx", NO_RECORD: "1", BELL_OUT: "scratch/bell-before.out" },
  }),
);
const after = plain(execSync("node scratch/measure-bell-contract.mjs", opts));

function token(log, re, label) {
  const m = re.exec(log);
  if (!m) throw new Error("no measured value for " + label);
  return m[1];
}

function day(log, re, label) {
  const m = re.exec(log);
  if (!m) throw new Error("no measured date for " + label);
  return `${AR(m[2])} ${MONTHS[m[1]]} ${AR(m[3])}`;
}

const B = {
  declared: token(before, /BELL_DECLARED_FIELDS=(\d+)/, "before declared"),
  phantom: token(before, /BELL_DECLARES_WHAT_DOOR_NEVER_ANSWERS=(\d+)/, "before phantom"),
  ignored: token(before, /DOOR_SENDS_WHAT_BELL_IGNORES=(\d+)/, "before ignored"),
  asked: token(before, /BELL_ASKS=(\d+)/, "before asked"),
  sliced: token(before, /BELL_SLICES_TO=(\d+)/, "before sliced"),
  checked: token(before, /BELL_MARK_READ_CHECKS_DOOR_REPLY=(\w+)/, "before checks reply"),
  flag: token(before, /BELL_MARK_READ_WRITES_LOCAL_FLAG=(\w+)/, "before local flag"),
  latin: token(before, /BELL_BADGE_LATIN_BRANCH=(\w+)/, "before latin badge"),
  footerFake: token(before, /BELL_FOOTER_BUTTON_ONLY_CLOSES=(\w+)/, "before footer closes only"),
  mounted: token(before, /BELL_MOUNTED_AT=(\d+)/, "before mounted"),
};

const A = {
  declared: token(after, /BELL_DECLARED_FIELDS=(\d+)/, "after declared"),
  answered: token(after, /DOOR_ROW_FIELDS=(\d+)/, "door row fields"),
  phantom: token(after, /BELL_DECLARES_WHAT_DOOR_NEVER_ANSWERS=(\d+)/, "after phantom"),
  ignored: token(after, /DOOR_SENDS_WHAT_BELL_IGNORES=(\d+)/, "after ignored"),
  asked: token(after, /BELL_ASKS=(\d+)/, "after asked"),
  showsAll: token(after, /SHOWS_EVERY_ROW_RETURNED=(\w+)/, "after shows every row"),
  checked: token(after, /BELL_MARK_READ_CHECKS_DOOR_REPLY=(\w+)/, "after checks reply"),
  flag: token(after, /BELL_MARK_READ_WRITES_LOCAL_FLAG=(\w+)/, "after local flag"),
  latin: token(after, /BELL_BADGE_LATIN_BRANCH=(\w+)/, "after latin badge"),
  arabic: token(after, /BELL_RENDERED_DIGITS_ARE_ARABIC=(\w+)/, "after arabic digits"),
  footerFake: token(after, /BELL_FOOTER_BUTTON_ONLY_CLOSES=(\w+)/, "after footer closes only"),
  mounted: token(after, /BELL_MOUNTED_AT=(\d+)/, "after mounted"),
  published: token(after, /REALTIME_PUBLISHED_TABLES=(\d+)/, "published tables"),
  hasAgent: token(after, /PUBLISHED_HAS_agent_events=(\w+)/, "old event table published"),
  hasLedger: token(after, /PUBLISHED_HAS_ops_sync_events=(\w+)/, "ledger published"),
  deadRows: token(after, /AGENT_EVENTS_ROWS=(\d+)/, "old event table rows"),
  deadCols: token(after, /AGENT_EVENTS_COLUMNS=(\d+)/, "old event table columns"),
  ledgerRows: token(after, /LEDGER_ROWS=(\d+)/, "ledger rows"),
  deadLastDay: day(after, /AGENT_EVENTS_ROWS=\d+ LAST_WRITE=(?:\w+ )?(\w+) (\d+) (\d+)/, "old table last write"),
  ledgerLastDay: day(after, /LEDGER_ROWS=\d+ LAST_WRITE=(?:\w+ )?(\w+) (\d+) (\d+)/, "ledger last write"),
};

for (const [k, v] of Object.entries({ ...B, ...A })) {
  if (v === undefined || v === null || v === "") throw new Error("token has no value: " + k);
}
if (A.phantom !== "0" || A.ignored !== "0") throw new Error("the repair did not land: phantom=" + A.phantom + " ignored=" + A.ignored);
if (A.checked !== "true" || A.flag !== "false" || A.latin !== "false" || A.arabic !== "true" || A.footerFake !== "false" || A.showsAll !== "true")
  throw new Error("the bell is still not honest: " + JSON.stringify(A));
if (B.checked !== "false" || B.flag !== "true" || B.latin !== "true") throw new Error("the before-reading does not show the defect");
if (A.hasAgent !== "false" || A.hasLedger !== "false") throw new Error("a channel is now live: the refusal wording must change");

const suite = plain(fs.readFileSync("scratch/bell-fullsuite.out", "utf8"));
const tests = /Tests\s+([\d,]+) passed/.exec(suite)?.[1];
if (!tests) throw new Error("no measured test total");

const guards = plain(
  execSync(
    "node node_modules/vitest/vitest.mjs run tests/dal/realtimeVerdict.test.ts tests/ops/alertStripOneOwner.test.ts --reporter=basic",
    opts,
  ),
);
const guardTotal = /Tests\s+([\d,]+) passed/.exec(guards)?.[1];
const channelGuards = /realtimeVerdict\.test\.ts[^(]*\((\d+) tests?\)/.exec(guards)?.[1];
const stripGuards = /alertStripOneOwner\.test\.ts[^(]*\((\d+) tests?\)/.exec(guards)?.[1];
if (!guardTotal || !channelGuards || !stripGuards) throw new Error("no measured guard counts");

const mountedPhrase =
  B.mounted === "0"
    ? "وما فيش أي شاشة في اللوحة مركّبا عليه — فكان عقد قديم بيموت في صمت"
    : `ومركّب في ${AR(B.mounted)} شاشة`;

const msg =
  "fix(alerts): الجرس التاني بقى ما يفتيش عن عقد الباب ما بيردّش — والقناة اللي ما بيوصلهاش تنبيه بقيت بيسمّوا سببها" +
  "\n\n" +
  `القياس على الملفين بنفس المِقياس: الباب يردّ بـ${AR(A.answered)} حقول للسطر. الجرس القديم كان بيعلن ${AR(B.declared)} حقول منهم ${AR(B.phantom)} مالوش وجود، ` +
  `وبيسيب ${AR(B.ignored)} حقول الباب بيردّ بيها ساكن (عدد اللي اتقريت وجملة السكون) · كان بيقرا ${AR(B.asked)} سطر ويعرض منهم ${AR(B.sliced)} · ` +
  `تعليم الكل كمقروء كان بيجاوب على نفسه من غير ما يسمع ردّة الباب، وحاطط علامة مقروء على الشاشة مش في الدفتر · ` +
  `الشارة بتطبع بحروف لاتينية · والزرّ اللي تحت مكتوب «عرض جميع» وشغلته الحقيقية تقفل الشريط بس · ${mountedPhrase}` +
  "\n\n" +
  `الإصلاح: حقوق الجرس بقت ${AR(A.declared)} يردّ الباب على كل واحد فيهم، وعدد اللي اتقريت وجملة السكون بقى الباب اللي بيقولهم، ` +
  `والسؤال والعرض بقى نفس العدد ${AR(A.asked)}، والرفض بيظهر بعد ما يتقرا من ردّة الباب، والشارة بحروف عربي، ` +
  `و«عرض جميع» بقى وصلة حقيقية لصفحة التحكم · والجملة اللي بتسمّي رفض مش عربي اتنقلت لمالكها في قاعدة التنبيهات، فالشاشتين بيقولوا نفس الجملة` +
  "\n\n" +
  `وعلى نفس القياس من النسخة الحيّة: النشرة اللي بتوصل تنبيهات فورها فيها ${AR(A.published)} جدول، ومالهاش وجود فيهم لا جدول الأحداث القديم ` +
  `(${AR(A.deadCols)} عمود، ${AR(A.deadRows)} سطر، آخر كتابة ${A.deadLastDay}) ولا دفتر المتجر نفسه (${AR(A.ledgerRows)} سطر، آخر كتابة ${A.ledgerLastDay}) · ` +
  `فالاشتراك اللي كان بيفتح هناك ما كانش بيوصلّه ولا تنبيه، وبقي يرفض ويسمّي السبب ويقول إن التنبيهات تتقرا من الدفتر` +
  "\n\n" +
  `البوابات: ${AR(tests.replace(/,/g, ""))} اختبار أخضر · تيبشك سليم · بناء كامل · ${AR(guardTotal.replace(/,/g, ""))} حارس في الملفين دول ` +
  `(${AR(channelGuards)} في ملف جديد على القناة الحيّة و${AR(stripGuards)} في ملف التنبيهات)`;

const prose = msg.replace(/^fix\([a-z]+\): /, "");
const latin = (prose.match(/[A-Za-z]{4,}/g) ?? []).filter((w) => w !== "dal");
if (latin.length) throw new Error("Latin words leaked: " + latin.join(", "));
if (/[0-9]/.test(prose)) throw new Error("Latin digits leaked");
if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\u0590-\u05ff]/.test(msg)) throw new Error("a non-Arabic script leaked");
if (msg.includes("undefined") || msg.includes("NaN")) throw new Error("a token had no measured value");

fs.writeFileSync("scratch/commit-msg.txt", msg, "utf8");
console.log("before:", JSON.stringify(B));
console.log("after:", JSON.stringify(A));
console.log("---");
console.log(msg);
