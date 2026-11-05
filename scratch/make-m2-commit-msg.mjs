/**
 * make-m2-commit-msg.mjs — the M2 commit line, from numbers a command printed this session.
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

const ESC = String.fromCharCode(27);
const plain = (s) => s.replace(new RegExp(ESC + "\\[[0-9;]*m", "g"), "");
const AR = (n) => String(n).replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));

const gate = plain(fs.readFileSync("scratch/m2-gate.out", "utf8"));
const coverage = JSON.parse(fs.readFileSync("docs/ledger/backup-coverage.json", "utf8"));
const unit = plain(fs.readFileSync("scratch/m2-unit.out", "utf8"));

function token(text, re, label) {
  const m = re.exec(text);
  if (!m) throw new Error("no measured value for " + label);
  return m[1];
}

const T = {
  TESTS: token(gate, /(\d+) اختبار ·/, "gate tests"),
  PASSED: token(gate, /· (\d+) أخضر ·/, "gate passed"),
  FAILED: token(gate, /· (\d+) أحمر ·/, "gate failed"),
  SKIPPED: token(gate, /· (\d+) متخطّى/, "gate skipped"),
  TYPECHECK: token(gate, /^typecheck=(\S+)/m, "typecheck"),
  BUILD: token(gate, /^build=(\S+)/m, "build"),
  UNIT: token(unit, /Tests\s+(\d+) passed/, "unit tests"),
  UNIT_FILES: token(unit, /Test Files\s+(\d+) passed/, "unit files"),
  RECORD_TABLES: String(coverage.tablesInRecord),
  COPIED: String(coverage.copied.length),
  ROWS_COPIED: String(coverage.rowsCopied),
  CREDENTIAL: String(coverage.credentialTables.length),
  UNEXPLAINED: String(coverage.unexplained.length),
  ROWS_UNEXPLAINED: String(coverage.rowsUnexplained),
  TARGETS_BEFORE: String(
    (execSync("git show HEAD:lib/ops/nightly-snapshot.ts", { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).match(
      /\{ table: "[a-z_]+", order:/g,
    ) ?? []).length,
  ),
};

for (const [k, v] of Object.entries(T)) {
  if (v === undefined || v === null || v === "" || v === "undefined") throw new Error("token has no value: " + k);
}

if (T.FAILED !== "0") throw new Error("the suite reported failures");
if (T.TYPECHECK !== "PASS" || T.BUILD !== "PASS") throw new Error("a gate refused");

const msg =
  `build(backup): المرحلة اتنين — الضهر بقى يطال الشغل، وباب استرجاع مرفوض حتى يثبت نفسه` +
  `\n\n` +
  `القياس: المخزن فيه ${AR(T.RECORD_TABLES)} جدول، والنسخة الليلية كانت بتاخد ${AR(T.TARGETS_BEFORE)} بس · الشغل نفسه — الطلبات والعملاء والورق المرسوم والأقسام والمسودات — كان برّا الضهر` +
  ` · بقى الطقم ${AR(T.COPIED)} جدول (${AR(T.ROWS_COPIED)} سطر) · و${AR(T.CREDENTIAL)} جدول فيه عمود مفتاح مستبعد بالقياس من أعمدته، مش من اسمه` +
  ` · ولسه ${AR(T.UNEXPLAINED)} جدول عليه سطور ومفيش سبب مكتوب (${AR(T.ROWS_UNEXPLAINED)} سطر) — دول مكتوبين بالاسم في ملف الغطاء وما اتخمنش ليهم حكم` +
  `\n\n` +
  `اللي اتبنى: الطقم في مالك واحد (ملف الغطاء) والجدول اللي مالوش مفتاح ترتيب صحيح بيقعد برّا بسببه مكتوب · باب النسخة يردّ بحالة الختم وبيرجّع عدّاد السطور من الملف المرجوع مش من الكتابة · وباب الاسترجاع مرفوض إلا بأربع شروط: الجدول في الطقم، والختم يحمل اليوم، والنسخة اتأكدت من نفسها، والكلمة الصريحة لو المطلوب الجدول كله — ومن غير كلمة بيرجع بس السطور اللي عليها علامة الأداة · وسطر «آخر نسخة» بقى على الكابينة من الباب` +
  `\n\n` +
  `البوابات: ${AR(T.TESTS)} اختبار (${AR(T.PASSED)} أخضر · ${AR(T.FAILED)} أحمر · ${AR(T.SKIPPED)} متخطّى) · منها ${AR(T.UNIT)} في ${AR(T.UNIT_FILES)} ملف للغطاء وخطة الاسترجاع · تيبشك سليم · بناء سليم بمحرك السيرفر · والدليل الحيّ على المنشور لسه ما اتشغّلش`;

const prose = msg.replace(/^build\(backup\): /, "");
const latin = (prose.match(/[A-Za-z]{3,}/g) ?? []).filter((w) => !["PASS", "REFUSED"].includes(w));
if (latin.length) throw new Error("Latin words leaked: " + latin.join(", "));
if (/[0-9]/.test(prose)) throw new Error("Latin digits leaked: " + (prose.match(/[0-9]+/g) ?? []).join(","));
if (msg.includes("undefined") || msg.includes("NaN")) throw new Error("a token had no measured value");

fs.writeFileSync("scratch/commit-msg.txt", msg, "utf8");
console.log("measured:", JSON.stringify(T));
console.log("---");
console.log(msg);
