import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * What in the old dashboard has no home in the new one — measured from the doors each house calls.
 *
 * The transfer ledger (docs/ledger/transfers.json) is a file census written 2026-10-13 and marks all
 * seventeen old pages «not-moved», which the last six days of building already contradicted. So this
 * reads the actual code: every API door a screen fetches, reached through the components it imports,
 * then splits the doors into three honest piles — shared by both houses, held only by the new one,
 * and held ONLY by the old one. The last pile is what has not moved.
 */
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

const files = walk("app").concat(walk("components"), walk("lib"));
const DOOR = /["'`]((?:https?:\/\/[^"'`]*?)?\/api\/[a-zA-Z0-9/[][_\]A-Za-z0-9-]*)/g;

function doorsOf(predicate) {
  const found = new Set();
  for (const f of files) {
    if (!predicate(f)) continue;
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(DOOR)) found.add(m[1].replace(/^https?:\/\/[^/]+/, "").replace(/\/+$/, ""));
  }
  return found;
}

const isOld = (f) => /^app[\\/]admin[\\/](?!v2)/.test(f) || /[\\/]components[\\/]admin[\\/]/.test(f) && !/v2/i.test(f);
const isNew = (f) => /^app[\\/]admin[\\/]v2/.test(f) || /v2/i.test(f);

const oldDoors = doorsOf((f) => isOld(f) && !isNew(f));
const newDoors = doorsOf((f) => isNew(f));

const onlyOld = [...oldDoors].filter((d) => !newDoors.has(d)).sort();
const shared = [...oldDoors].filter((d) => newDoors.has(d)).sort();
const onlyNew = [...newDoors].filter((d) => !oldDoors.has(d)).sort();

console.log("أبواب تستدعيها اللوحة القديمة: " + oldDoors.size);
console.log("أبواب تستدعيها الجديدة: " + newDoors.size);
console.log("مشتركة: " + shared.length + " · حصرية للجديدة: " + onlyNew.length + " · حصرية للقديمة (لم تُنقل): " + onlyOld.length);
console.log("\n--- اللي ما اتنقلش ---");
for (const d of onlyOld) console.log("  " + d);

const oldScreens = readdirSync("app/admin").filter((n) => n !== "v2" && existsSync(join("app/admin", n, "page.tsx")));
const newScreens = readdirSync("app/admin/v2").filter((n) => existsSync(join("app/admin/v2", n, "page.tsx")) || existsSync(join("app/admin/v2", n)));
console.log("\nشاشات القديمة: " + oldScreens.length + " (" + oldScreens.join(", ") + ")");
console.log("شاشات الجديدة: " + newScreens.length + " (" + newScreens.join(", ") + ")");
