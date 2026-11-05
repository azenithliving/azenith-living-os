import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The owner's second word: the old config copies go too.
 *
 * What this does, in order:
 *   ١) leaves alone every file some script actually reads (the live ones and the platform helpers);
 *   ② moves the stale copies OUT of the project into the owner's archive, with the four credentials
 *      stripped from the copy — so the project is clean and the secrets exist in exactly one place;
 *   ③ strips those four lines from the kept copies too.
 * Nothing is destroyed on disk in this pass; the archive is his to erase with one word.
 * Names and counts only — no values are printed.
 */
const FOUR = ["DEV_BACKDOOR_PASSWORD", "NEXT_PUBLIC_INTERNAL_API_KEY", "CLOUDFLARE_API_TOKEN", "NEXT_PUBLIC_NEKO_PASSWORD"];
const ARCHIVE_DIR = "D:/alaa2/الشركة الجديدة/نسخ-احتياطية/env-old-2026-10-09";

const READ_BY_CODE = new Set([
  ".env.local",
  ".env",
  ".env.example",
  ".env.browser-workspace.example",
  ".env.vercel",
  ".env.vercel.local",
  ".env.vercel.tmp",
]);

function stripFour(text) {
  const kept = text.split(/\r?\n/).filter((line) => {
    const match = /^[A-Z][A-Z0-9_]*=/.test(line);
    return !(match && FOUR.includes(line.slice(0, line.indexOf("="))));
  });
  const removed = text.split(/\r?\n/).length - kept.length;
  return { text: kept.join("\n"), removed };
}

const envFiles = readdirSync(".").filter((f) => f.startsWith(".env") && statSync(f).isFile());
if (!existsSync(ARCHIVE_DIR)) mkdirSync(ARCHIVE_DIR, { recursive: true });

let moved = 0;
let strippedKept = 0;
let linesOut = 0;

for (const file of envFiles) {
  const text = readFileSync(file, "utf8");
  if (READ_BY_CODE.has(file)) {
    const { text: clean, removed } = stripFour(text);
    if (removed > 0) {
      writeFileSync(file, clean, "utf8");
      strippedKept += 1;
      linesOut += removed;
      console.log(`نظّفنا الملف الحيّ من الأربعة: ${file} (−${removed} سطر)`);
    }
    continue;
  }
  const { text: clean, removed } = stripFour(text);
  writeFileSync(join(ARCHIVE_DIR, file), clean, "utf8");
  rmSync(file);
  moved += 1;
  linesOut += removed;
  console.log(`طلع بره المشروع: ${file} (−${removed} سطر اعتماد)`);
}

const left = readdirSync(".").filter((f) => f.startsWith(".env"));
const stillHolding = left.filter((f) => {
  try {
    return FOUR.some((n) => new RegExp(`^${n}=`, "m").test(readFileSync(f, "utf8")));
  } catch {
    return false;
  }
});
const localNames = readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z][A-Z0-9_]*=/.test(l)).length;

console.log(`\nملفات اتنقلت للأرشيف: ${moved} · ملفات حية اتنظفت: ${strippedKept} · أسطر اعتماد خرجت: ${linesOut}`);
console.log(`اللي فضل في جذر المشروع: ${left.length} — ${left.join(", ")}`);
console.log(`ملفات لسه جواها واحد من الأربعة: ${stillHolding.length ? stillHolding.join(", ") : "ولا واحد"}`);
console.log(`أسماء في الملف الحيّ: ${localNames}`);
console.log(`الأرشيف: ${ARCHIVE_DIR}`);
