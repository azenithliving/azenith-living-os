import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

/**
 * The owner's word, 2026-10-09: remove these four credential names from the local config file.
 * Nothing is printed but names and counts. The removed lines are kept OUTSIDE the repository, in
 * the owner's own backup archive, so the act is reversible until he says otherwise.
 */
const FILE = ".env.local";
const ARCHIVE_DIR = "D:/alaa2/الشركة الجديدة/نسخ-احتياطية";
const ARCHIVE = `${ARCHIVE_DIR}/env-local-removed-2026-10-09.txt`;
const TARGETS = [
  "DEV_BACKDOOR_PASSWORD",
  "NEXT_PUBLIC_INTERNAL_API_KEY",
  "CLOUDFLARE_API_TOKEN",
  "NEXT_PUBLIC_NEKO_PASSWORD",
];

const before = readFileSync(FILE, "utf8");
const lines = before.split(/\r?\n/);
const namesBefore = lines.filter((l) => /^[A-Z][A-Z0-9_]*=/.test(l)).map((l) => l.slice(0, l.indexOf("=")));

const removed = [];
const kept = lines.filter((line) => {
  const name = line.startsWith("$") ? "" : line.slice(0, line.indexOf("="));
  const hit = /^[A-Z][A-Z0-9_]*=/.test(line) && TARGETS.includes(name);
  if (hit) removed.push(name);
  return !hit;
});

const after = kept.join("\n");
const namesAfter = kept.filter((l) => /^[A-Z][A-Z0-9_]*=/.test(l)).map((l) => l.slice(0, l.indexOf("=")));

if (removed.length !== TARGETS.length) {
  console.log(`وقفت: لقيت ${removed.length} من ${TARGETS.length} — الملف ما اتغيّرش`);
  process.exit(1);
}

if (!existsSync(ARCHIVE_DIR)) mkdirSync(ARCHIVE_DIR, { recursive: true });
if (!existsSync(ARCHIVE)) {
  writeFileSync(ARCHIVE, lines.filter((l) => /^[A-Z][A-Z0-9_]*=/.test(l) && TARGETS.includes(l.slice(0, l.indexOf("=")))).join("\n") + "\n", "utf8");
}

writeFileSync(FILE, after, "utf8");

const check = readFileSync(FILE, "utf8");
const stillThere = TARGETS.filter((n) => new RegExp(`^${n}=`, "m").test(check));

console.log(`أسماء قبل: ${namesBefore.length} · بعدها: ${namesAfter.length} · اللي مسحناهم: ${removed.length}`);
console.log(`فاضل في الملف من الأربعة: ${stillThere.length ? stillThere.join(", ") : "ولا واحد"}`);
console.log(`الأسماء التانية سليمة: ${namesAfter.length === namesBefore.length - 4 ? "أيوه بالظبط" : "لأ — راجع"}`);
console.log(`نسخة الاحتياط بره المستودع: ${existsSync(ARCHIVE) ? ARCHIVE : "ما اتعملتش"}`);
