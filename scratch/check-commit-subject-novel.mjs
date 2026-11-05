import { execFileSync } from "node:child_process";

/**
 * Is this commit subject new?
 *   node scratch/check-commit-subject-novel.mjs "the proposed subject"
 *
 * Measured again today: I committed a decided-status fix under the subject of an earlier badge fix —
 * a reused line I have been caught on before, and the only defense that works is a mechanical one,
 * because the copy-paste feels invisible while I am writing it. Exits non-zero when the first words
 * already appear in recent history.
 */
const subject = (process.argv[2] ?? "").trim();
if (!subject) {
  console.error("مطلوب سطر الحفظ");
  process.exit(2);
}

const recent = execFileSync("git", ["log", "--format=%s", "-30"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);
const key = subject.toLowerCase().split(/\s+/).slice(0, 6).join(" ");

const clash = recent.filter((line) => line.toLowerCase().includes(key));
if (clash.length) {
  console.error(`REUSED SUBJECT — first six words already appear ${clash.length}× recently:`);
  for (const line of clash.slice(0, 3)) console.error(`  ${line}`);
  process.exit(1);
}

console.log("novel subject ✓ (no clash in the last 30)");
