/**
 * make-m1-commit-msg.mjs — the M1 commit line, built only from numbers a command printed.
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

import { phaseById } from "../lib/build/phase-map.ts";

const ESC = String.fromCharCode(27);
const plain = (s) => s.replace(new RegExp(ESC + "\\[[0-9;]*m", "g"), "");
const AR = (n) => String(n).replace(/[0-9]/g, (d) => String.fromCharCode(0x660 + Number(d)));

const gate = plain(fs.readFileSync("scratch/m1-gate.out", "utf8"));
const census = plain(fs.readFileSync("scratch/m1-census4.out", "utf8"));
const dead = plain(fs.readFileSync("scratch/m1-dead.out", "utf8"));
const unit = plain(fs.readFileSync("scratch/m1-unit.out", "utf8"));

function token(text, re, label) {
  const m = re.exec(text);
  if (!m) throw new Error("no measured value for " + label);
  return m[1];
}

const before = JSON.parse(execSync("git show HEAD:docs/ledger/movements.json", { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }));
const handRows = (before.rows ?? []).filter((r) => r.phase !== undefined);
const handSpellings = new Set(handRows.map((r) => r.phase)).size;

const T = {
  TESTS: token(gate, /(\d+) اختبار ·/, "gate test total"),
  PASSED: token(gate, /· (\d+) أخضر ·/, "gate passed"),
  FAILED: token(gate, /· (\d+) أحمر ·/, "gate failed"),
  SKIPPED: token(gate, /· (\d+) متخطّى/, "gate skipped"),
  TYPECHECK: token(gate, /^typecheck=(\S+)/m, "typecheck"),
  BUILD: token(gate, /^build=(\S+)/m, "build"),
  LIVE: token(gate, /^live=(\S+)/m, "live"),
  ATOMS: token(census, /census.json \((\d+) atoms\)/, "atoms"),
  ORPHAN_NEW: token(census, /"orphanDoors": (\d+)/, "orphan doors now"),
  ORPHAN_OLD: token(
    execSync("git show HEAD:docs/ledger/census.json", { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }),
    /"orphanDoors": (\d+)/,
    "orphan doors before",
  ),
  DEAD_LINE: token(dead, /^(٧.*باب يتيم.*)$/m, "dead line"),
  HAND_ROWS: String(handRows.length),
  HAND_SPELLINGS: String(handSpellings),
  PHASE_JSON: token(census, /phases seated by office: (\{.*\})/, "phase tally"),
  UNIT: token(unit, /Tests\s+(\d+) passed/, "unit tests"),
  UNIT_FILES: token(unit, /Test Files\s+(\d+) passed/, "unit files"),
};

for (const [k, v] of Object.entries(T)) {
  if (v === undefined || v === null || v === "") throw new Error("token has no value: " + k);
}
if (T.FAILED !== "0") throw new Error("the suite reported failures");
if (T.TYPECHECK !== "PASS" || T.BUILD !== "PASS") throw new Error("a gate refused");

const phases = JSON.parse(T.PHASE_JSON);
const named = Object.entries(phases)
  .map(([id, n]) => ({ label: phaseById(id)?.label ?? "ما اتقارش", n }))
  .sort((a, b) => b.n - a.n);
const biggest = named[0];

const msg =
  `build(ruler): المرحلة واحد — كل ذرة ليها مرحلة محسوبة من مكتبها، وخريطة ميت، وشاشة المِسطرة` +
  `\n\n` +
  `القياس: السجل فيه ${AR(T.ATOMS)} ذرة، و${AR(T.HAND_ROWS)} سطر كان حامل مرحلة مكتوبة باليد بـ${AR(T.HAND_SPELLINGS)} كتابة مختلفة` +
  ` · المرحلة بقت بتتحسب من المكتب اللي الذرة مقعدة فيه، فالسؤال «مين صاحب المرحلة» رجع لمالك واحد` +
  ` · التوزيع: ${named.map((p) => `«${p.label}» ${AR(p.n)}`).join(" · ")}` +
  ` · أكبرها «${biggest.label}» بـ${AR(biggest.n)} ذرة` +
  `\n\n` +
  `الأبواب اليتيمة: كانت ${AR(T.ORPHAN_OLD)} وبقت ${AR(T.ORPHAN_NEW)} — لأن الجدول اليومي اللي في ملف النشر كان بيتحسب ميت وهو شغال كل يوم` +
  ` · والتصنيف: ${T.DEAD_LINE} · ومفيش باب اتشال ولا سطر اتمسح` +
  `\n\n` +
  `السطح الجديد: باب المِسطرة وشاشتها عند عرض الموبايل، والباب بيردّ على الغريب برفض عربي، واللي مالوش مصدر في النسخة المنشورة بيتسمّى «ما اتقارش»` +
  ` · واختبارات طبقة البناء ${AR(T.UNIT)} في ${AR(T.UNIT_FILES)} ملف` +
  `\n\n` +
  `البوابات: ${AR(T.TESTS)} اختبار (${AR(T.PASSED)} أخضر · ${AR(T.FAILED)} أحمر · ${AR(T.SKIPPED)} متخطّى) · تيبشك سليم · بناء سليم · الدليل الحيّ ${T.LIVE === "PASS" ? "سليم" : "ما اتشغّلش"}`;

const prose = msg.replace(/^build\(ruler\): /, "");
const latin = (prose.match(/[A-Za-z]{3,}/g) ?? []).filter((w) => !["PASS", "REFUSED"].includes(w));
if (latin.length) throw new Error("Latin words leaked: " + latin.join(", "));
if (/[0-9]/.test(prose)) throw new Error("Latin digits leaked: " + (prose.match(/[0-9]+/g) ?? []).join(","));
if (msg.includes("undefined") || msg.includes("NaN")) throw new Error("a token had no measured value");

fs.writeFileSync("scratch/commit-msg.txt", msg, "utf8");
console.log("measured:", JSON.stringify(T));
console.log("---");
console.log(msg);
