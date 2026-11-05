import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * The strict pass: an environment name counts as read only when code reaches for it with
 * `process.env.<name>` (or the framework's equivalent) in a file that actually ships —
 * not a mention inside a comment, a test fixture or a README.
 * Names only; no values are printed.
 */
const roots = ["app", "lib", "components", "scripts", "utils", "stores", "prisma", "config"];
const extraFiles = ["next.config.ts", "next.config.mjs", "vercel.json", "package.json", "proxy.ts"];

function sources(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.(ts|tsx|js|mjs|cjs)$/.test(full) ? [full] : [];
  });
}

const files = [...roots.flatMap(sources), ...extraFiles.filter((f) => existsSync(f))].filter(
  (f) => !f.includes(".test.")
);
const read = files.map((path) => ({ path, text: readFileSync(path, "utf8") }));
console.log(`shipping files read: ${read.length}`);

const names = readFileSync(".env.local", "utf8")
  .split(/\r?\n/)
  .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
  .map((line) => line.slice(0, line.indexOf("=")));

const orphan = [];
for (const name of names) {
  const used = read.some(({ text }) =>
    new RegExp(`process\\.env\\.${name}\\b|env\\.${name}\\b|\\[["']${name}["']\\]`).test(text)
  );
  if (!used) orphan.push(name);
}

const CRED = /(_KEY|_SECRET|_TOKEN|_PASSWORD|SERVICE_ROLE|APIKEY|_PW$)/;
console.log(`\nenv names: ${names.length} · never reached by shipping code: ${orphan.length} · of those credential-shaped: ${orphan.filter((n) => CRED.test(n)).length}`);
for (const n of orphan) console.log(`  ${n}${CRED.test(n) ? "  ← بيانات اعتماد" : ""}`);
