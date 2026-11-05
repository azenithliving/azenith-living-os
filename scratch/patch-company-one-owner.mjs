import fs from "node:fs";

/**
 * One owner for «which company is this store».
 *
 * Ten places read `process.env.MASTER_COMPANY_ID` directly, and that variable is not set in this
 * deployment (measured 2026-10-23: absent from .env.local), so every row those writers create is
 * stored with no company — which is how 52 of the 56 papers waiting for the owner became rows his
 * decision door cannot see. The resolver in lib/admin-env-resolver.ts already answers the question
 * from the store's own recorded decision, and five other places call it. This patch points the
 * readers at the resolver and changes nothing else.
 */
const FILES = [
  "lib/admin-approved-executor.ts",
  "lib/admin-assistant-log.ts",
  "lib/admin-cloud-evolution.ts",
  "lib/admin-daily-report.ts",
  "lib/admin-extended-handlers.ts",
  "lib/admin-natural-brain.ts",
  "lib/admin-owner-memory.ts",
  "lib/admin-sovereign-mind.ts",
];

const IMPORT_LINE = 'import { resolveMasterCompanyId } from "@/lib/admin-env-resolver";';

for (const file of FILES) {
  const before = fs.readFileSync(file, "utf8");
  const hits = (before.match(/process\.env\.MASTER_COMPANY_ID/g) ?? []).length;
  if (!hits) { console.log(`${file}: مفيش قارئ مباشر`); continue; }

  let after = before.replace(/process\.env\.MASTER_COMPANY_ID/g, "(await resolveMasterCompanyId())");

  if (!/from ["']@\/lib\/admin-env-resolver["']/.test(after)) {
    const lines = after.split("\n");
    const lastImport = lines.reduce((acc, line, i) => (/^import\s/.test(line) ? i : acc), -1);
    if (lastImport < 0) throw new Error(`${file}: مفيش سطر استيراد أتمسك بيه`);
    lines.splice(lastImport + 1, 0, IMPORT_LINE);
    after = lines.join("\n");
  }

  fs.writeFileSync(file, after);
  console.log(`${file}: عدّلت ${hits} قراءة`);
}
