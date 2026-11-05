import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Classify every local config copy before anything is removed: does any shipping file or script
 * read it by name, is it the newest of its family, and does it still carry the four credentials
 * the owner ordered out. Names and counts only — no values.
 */
const FOUR = ["DEV_BACKDOOR_PASSWORD", "NEXT_PUBLIC_INTERNAL_API_KEY", "CLOUDFLARE_API_TOKEN", "NEXT_PUBLIC_NEKO_PASSWORD"];

const files = readdirSync(".").filter((f) => f.startsWith(".env"));

function walk(dir, out) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|mjs|cjs|json)$/.test(entry)) out.push(full);
  }
  return out;
}

const codeFiles = walk("scripts", []).concat(walk("app", []), walk("lib", []), walk("components", []));
if (existsSync("package.json")) codeFiles.push("package.json");
const codeText = codeFiles.map((f) => ({ f, text: readFileSync(f, "utf8") }));
console.log(`ملفات كود مفحوصة: ${codeText.length}`);

function referenced(name) {
  return codeText.filter(({ text }) => text.includes(name)).map(({ f }) => f).slice(0, 3);
}

const rows = files.map((f) => {
  const text = (() => {
    try {
      return readFileSync(f, "utf8");
    } catch {
      return "";
    }
  })();
  const names = text.split(/\r?\n/).filter((l) => /^[A-Z][A-Z0-9_]*=/.test(l));
  return {
    file: f,
    bytes: statSync(f).size,
    mtime: statSync(f).mtime.toISOString().slice(0, 10),
    names: names.length,
    four: FOUR.filter((n) => new RegExp(`^${n}=`, "m").test(text)),
    usedBy: referenced(f),
  };
});

const newestByFamily = new Map();
for (const r of rows) {
  const family = r.file.replace(/\.backup.*$/, "").replace(/\.tmp.*$/, "").replace(/\.pull\.temp$/, "").replace(/\-\d.*$/, "");
  const best = newestByFamily.get(family);
  if (!best || r.mtime > best.mtime) newestByFamily.set(family, r);
}

console.log("ملف | تاريخ | حجم | أسماء | الأربعة | بيقراه حاجة؟ | الأحدث في عيلته؟");
for (const r of rows.sort((a, b) => (a.mtime < b.mtime ? 1 : -1))) {
  const isKept = r.file === ".env.local" || r.file.endsWith(".example");
  const newest = newestByFamily.get(r.file.replace(/\.backup.*$/, "").replace(/\.tmp.*$/, "").replace(/\.pull\.temp$/, ""))?.file === r.file;
  console.log(
    `${r.file} | ${r.mtime} | ${r.bytes} | ${r.names} | ${r.four.length} | ${r.usedBy.length ? r.usedBy.join(",") : "مفيش"} | ${isKept ? "ملف حي" : newest ? "أحدث نسخة" : "قديم"}`
  );
}
