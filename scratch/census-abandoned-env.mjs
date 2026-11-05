import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Which environment names does the store's own code never read?
 * Prints NAMES ONLY — never a value. A credential's length and shape are reported so an
 * abandoned key can be told apart from a live one without putting the secret on paper.
 */
const ENV_FILE = ".env.local";
const roots = ["app", "lib", "components", "scripts", "utils", "stores", "tests", "prisma", "config"];
const extraFiles = ["next.config.ts", "next.config.mjs", "vercel.json", "package.json", "middleware.ts", "proxy.ts"];

function sources(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.(ts|tsx|js|mjs|cjs|json|sql)$/.test(full) ? [full] : [];
  });
}

const files = [...roots.flatMap(sources), ...extraFiles.filter((f) => existsSync(f))];
const corpus = files.map((f) => ({ path: f, text: readFileSync(f, "utf8") }));
console.log(`ملفات مقروءة: ${corpus.length}`);

const names = readFileSync(ENV_FILE, "utf8")
  .split(/\r?\n/)
  .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
  .map((line) => line.slice(0, line.indexOf("=")));

const CRED = /(_KEY|_SECRET|_TOKEN|_PASSWORD|_API|APIKEY|SERVICE_ROLE|ACCESS_TOKEN|_PW$)/;

const rows = names.map((name) => {
  const hit = corpus.find(({ text }) => text.includes(name));
  const line = readFileSync(ENV_FILE, "utf8").split(/\r?\n/).find((l) => l.startsWith(`${name}=`)) ?? "";
  const raw = line.slice(name.length + 1).trim();
  const value = raw.replace(/^["']|["']$/g, "");
  const shape = value ? `${value.length} حرف` : "فاضي";
  const prefix = /^[a-z]{2,4}[-_][A-Za-z0-9]{4,}/i.test(value) ? value.slice(0, 3) : "";
  return { name, read: hit ? hit.path : null, shape, cred: CRED.test(name), prefix };
});

const unread = rows.filter((r) => !r.read);
const unreadCred = unread.filter((r) => r.cred);
const empty = rows.filter((r) => r.shape === "فاضي");

console.log(`\nأسماء في ملف الضبط: ${rows.length} · اللي الكود بيقراه: ${rows.length - unread.length} · اللي مش مقروء: ${unread.length} · منه بيانات اعتماد: ${unreadCred.length} · فاضي خالص: ${empty.length}`);

console.log("\n== بيانات اعتماد ما بتتقراش في أي ملف (دي المرشحة للتطهير) ==");
for (const r of unreadCred) console.log(`  ${r.name} — ${r.shape}${r.prefix ? ` · يبدأ بـ «${r.prefix}…»` : ""}`);

console.log("\n== أسماء تانية مهجورة (مش مفاتيح) ==");
for (const r of unread.filter((x) => !x.cred)) console.log(`  ${r.name} — ${r.shape}`);

console.log("\n== أسماء موجودة وفاضية ==");
for (const r of empty) console.log(`  ${r.name}${r.read ? "" : " (ومش مقروء كمان)"}`);
