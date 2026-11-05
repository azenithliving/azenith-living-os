import fs from "node:fs";
import { spawnSync } from "node:child_process";

const stripAnsi = (s) => s.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
const readers = stripAnsi(fs.readFileSync("scratch/measure-settings-readers.out", "utf8"));
const tests = stripAnsi(fs.readFileSync("scratch/registry-tests.out", "utf8"));
const gates = stripAnsi(fs.readFileSync("scratch/registry-gates.out", "utf8"));

const num = (re, text, name) => {
  const m = text.match(re);
  if (!m) throw new Error("missing measurement: " + name);
  return Number(m[1]);
};

const KEYS = num(/^keys in the table: (\d+)/m, readers, "table keys");
const FILES = num(/^code files walked: (\d+)/m, readers, "walked files");
const LIVE = num(/^SPLIT live=(\d+)/m, readers, "live keys");
const ADMIN_ONLY = num(/^SPLIT live=\d+ admin-only=(\d+)/m, readers, "admin-only keys");
const NO_CODE = num(/no-code=(\d+)/, readers, "keys no code touches");

const TESTS = num(/Tests\s+(\d+) passed/, tests, "tests passed");
if (num(/VITEST_EXIT=(\d+)/, gates, "vitest exit") !== 0) throw new Error("the test run refused");
if (num(/TSC_EXIT=(\d+)/, gates, "tsc") !== 0) throw new Error("tsc failed");
if (num(/BUILD_EXIT=(\d+)/, gates, "build") !== 0) throw new Error("build failed");

// The registry as it stood before this atom, counted from the committed file — not from memory.
const before = spawnSync("git", ["show", "HEAD~2:lib/settings/facts.ts"], { encoding: "utf8" });
if (before.status !== 0) throw new Error("could not read the committed registry: " + before.stderr.slice(0, 120));
const OLD_NAMED = (before.stdout.match(/^\s*(\{ )?key: "/gm) ?? []).length;
const NEW_NAMED = (fs.readFileSync("lib/settings/facts.ts", "utf8").match(/^\s*(\{ )?key: "/gm) ?? []).length;
const GUARDS = (fs.readFileSync("tests/settings/facts.test.ts", "utf8").match(/^\s*it\(/gm) ?? []).length;

if (NEW_NAMED !== KEYS) throw new Error(`the registry names ${NEW_NAMED} of ${KEYS} keys`);
if (LIVE + ADMIN_ONLY + NO_CODE !== KEYS) throw new Error("the reader split does not add up");

const AR = (n) => String(n).replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));

const T = { KEYS, FILES, LIVE, ADMIN_ONLY, NO_CODE, OLD_NAMED, NEW_NAMED, TESTS, GUARDS };

const title = "fix(settings): مكتب الإعدادات بقى بيسمي العشرين مفتاح — تلاتة منهم كان السجل ما بيعرفش أسماءهم";

const msg = `${title}

القياس من الكود نفسه (${AR(FILES)} ملف): السجل فيه (${AR(KEYS)}) مفتاح · (${AR(LIVE)}) منهم بيقرا كود خارج شاشات الإدارة قيمتهم · (${AR(ADMIN_ONLY)}) ما بيقربش منهم غير تبويبات اللوحة القديمة · (${AR(NO_CODE)}) ما بيلمسهمش كود خالص · وسجل الحقائق كان بيسمي (${AR(OLD_NAMED)}) بس، فالتلاتة اللي اتكتبت بعده (رقم الشغل، سطر التحقق بخطوتين، بصمة النسخة الليلية) مالهاش اسم عنده، ولو اتعرضت على شاشة كانت هتطلع باسم الكود بتاعها.

المكتب بقى بيقول عن كل واحد منهم حالته من السجل نفسه: كام رقم مسجّل، والتحقق بخطوتين مقفول بأمر المالك ولا شغّال، ويوم آخر نسخة ليلية وكم سطر وجدول فيها · وعدد الباقي بقى على القياس: (${AR(ADMIN_ONLY)}) قيمة مسجّلة ومفيش شاشة بتعرضها للعميل — وده الصح، لأن اللوحة القديمة لسه بيقرا ويكتب دول، فما بقاش السطر يقول «ما بيقرأهاش أي سطح».

البوابات: ${AR(TESTS)} اختبار أخضر · تيبشك سليم · بناء كامل · (${AR(GUARDS)}) حارس على السجل.`;

const prose = msg.replace(/^fix\([a-z]+\): /, "");
const latin = (prose.match(/[A-Za-z]{4,}/g) ?? []).filter((w) => w !== "settings");
if (latin.length) throw new Error("Latin words leaked: " + latin.join(", "));
if (/[0-9]/.test(prose)) throw new Error("Latin digits leaked");
if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\u0590-\u05ff]/.test(msg)) throw new Error("a non-Arabic script leaked");
if (msg.includes("undefined") || msg.includes("NaN")) throw new Error("a token had no measured value");

fs.writeFileSync("scratch/commit-msg.txt", msg, "utf8");
console.log("measured:", JSON.stringify(T));
console.log(msg);
