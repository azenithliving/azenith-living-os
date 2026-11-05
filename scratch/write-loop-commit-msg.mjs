import fs from "node:fs";

const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const tests = stripAnsi(fs.readFileSync("scratch/loop-fullsuite.out", "utf8"));
const gates = stripAnsi(fs.readFileSync("scratch/loop-gates.out", "utf8"));
const producer = stripAnsi(fs.readFileSync("scratch/measure-approval-producer.out", "utf8"));
const jump = stripAnsi(fs.readFileSync("scratch/measure-approval-jump.out", "utf8"));

const num = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return Number(m[1]);
};

const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests passed");
if (num(/TSC_EXIT=(\d+)/, gates, "tsc") !== 0) throw new Error("tsc failed");
if (num(/BUILD_EXIT=(\d+)/, gates, "build") !== 0) throw new Error("build failed");
if (num(/TESTS_EXIT=(\d+)/, gates, "tests exit") !== 0) throw new Error("the suite failed");

const UNLABELED = num(/analytics -> (\d+)/, producer, "unlabeled analytics papers");
const HEALTH = num(/health -> (\d+)/, producer, "unlabeled health papers");
const PENDING = num(/^PENDING_NOW=(\d+)/m, jump, "pending papers");
const GUARDS = (fs.readFileSync("tests/ops/dailyReportNoLoop.test.ts", "utf8").match(/^\s*it\(/gm) ?? []).length;

const T = { TESTS, UNLABELED, HEALTH, PENDING, GUARDS };

const lines = [
  "التقرير اليومي بقى ما يفتحش ورقة عشان في ورق مستني — القياس قال إن الشغل المجدول كان بيفتح ورقة كل يوم الساعة ٨ و١١ دقيقة، والشرط كان «في ورق مستني»، والورقة اللي بيفتحها هي نفسها ورق مستني: الحلقة بتغذي نفسها، والتل بقى **{PENDING}** ورقة مستنية",
  "**{UNLABELED}** ورقة منهم وصفها «إجراء إداري» العام، و**{HEALTH}** كمان — يعني الورقة ما بتقولش هي مستنية إيه · بقى للأرقام اسم، وللفحص اسم، وللتعديل اسم، وللرد اسم · والتقرير اللي بيطلب توقيعه بيقول ليه: صحة ردّت بفشل، أو أرقام ما جتش · لو التقرير سليم، مفيش ورقة",
  "البوابات: **{TESTS}** اختبار أخضر · تيبشك سليم · بناء كامل · **{GUARDS} حراس** على الحلقة، منهم واحد بيثبت إن الشغل المجدول ما يفتحش ورقة لمجرد إن في ورق مستني، وواحد بيثبت إن الرفض من غير سر الشغل المجدول بيفضل مقفول",
  "ملحوظة: الـ **{PENDING}** ورقة اللي في التل دي بياناتك، ومفيش سطر يتمسح ولا يتغيّر من غير كلمتك — القرار ليك: يتقفلوا كأوراق فات وقتها، ولا يرفضوا، ولا يفضلوا زي ما هم لحد ما تقرأهم",
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
  .join("\n\n");

const allowed = Object.values(T).map(String).join("");
const words = (body.match(/[A-Za-z]{2,}/g) ?? []).filter((w) => !allowed.toLowerCase().includes(w.toLowerCase()));
if (words.length) throw new Error("Latin words leaked: " + words.join(", "));
const prose = body.replace(/`[^`]*`/g, "");
const strays = (prose.match(/[0-9]+/g) ?? []).filter((r) => !allowed.includes(r));
if (strays.length) throw new Error("Latin digits outside the tokens: " + strays.join(", "));
if (/[\u0590-\u05ff\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/.test(body)) throw new Error("a non-Arabic script leaked");
if (/\{[A-Z_0-9]+\}/.test(body)) throw new Error("an unreplaced token survived");
if (body.includes("undefined") || body.includes("NaN")) throw new Error("a token had no measured value");

fs.writeFileSync("scratch/commit-msg.txt", "fix(cron): " + body + "\n", "utf8");
console.log("المقاس:", JSON.stringify(T));
