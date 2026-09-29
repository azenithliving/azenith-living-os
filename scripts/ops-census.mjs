/**
 * ops-census.mjs — the inventory that no agent is allowed to remember.
 *
 * The migration program says the ledger is the reference, not the agent's memory,
 * and the owner's test is «I want to see that not one nail was forgotten». Neither
 * survives a hand-written list: files move, pages get added, and a list rotting
 * quietly is worse than no list. So the census is GENERATED from the repository —
 * every admin page, every service door, every shared component, every scheduled
 * job, every table the swarm writes — and a guard fails when a census atom has no
 * row in the map, or a map row points at something that no longer exists.
 *
 * Writes: docs/ledger/census.json
 * Usage: node scripts/ops-census.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const norm = (p) => p.split("\\").join("/");

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else acc.push(norm(full));
  }
  return acc;
}

const linesOf = (f) => {
  try { return readFileSync(f, "utf8").split("\n").length; } catch { return 0; }
};

const adminPages = walk("app/admin").filter((f) => f.endsWith("page.tsx"));
const oldPages = adminPages.filter((f) => !f.includes("app/admin/v2/"));
const newPages = adminPages.filter((f) => f.includes("app/admin/v2/"));
const adminDoors = walk("app/api").filter((f) => f.endsWith("route.ts"));
const adminOnlyDoors = adminDoors.filter((f) => f.startsWith("app/api/admin/"));
const furnitureFiles = walk("components/admin").filter((f) => /\.tsx?$/.test(f));
const opsFiles = walk("lib/ops").filter((f) => /\.ts$/.test(f));

/** The leaf resource of a door: /api/admin/ops/goals -> ops/goals */
function doorResource(path) {
  return norm(path).replace("app/api/", "").replace("/route.ts", "");
}

/** Duplicate service names: the same leaf under two or more parents. */
function duplicatedLeaves(doors) {
  const byLeaf = new Map();
  for (const d of doors) {
    const leaf = doorResource(d).split("/").pop();
    if (!byLeaf.has(leaf)) byLeaf.set(leaf, []);
    byLeaf.get(leaf).push(doorResource(d));
  }
  return [...byLeaf.entries()]
    .filter(([, paths]) => new Set(paths.map((p) => p.split("/")[0])).size > 1)
    .map(([leaf, paths]) => ({ leaf, count: paths.length, paths }));
}

const crons = existsSync("vercel.json")
  ? JSON.parse(readFileSync("vercel.json", "utf8")).crons ?? []
  : [];

const nav = readFileSync("lib/admin-nav.ts", "utf8");
const navHrefs = [...nav.matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]);

/**
 * Who can see a piece of furniture: the new house, the old house, both, or neither.
 *
 * Reachability is transitive on purpose. A component imported by another component
 * is still load-bearing: measuring only direct page imports called 37 of 57 files
 * «unimported» while the new house was actually standing on them. That number would
 * have justified deleting the old tree and dropped the new house with it.
 */
function importsFrom(text) {
  return [...text.matchAll(/["']((?:@\/|\.\/|\.\.\/)[^"']+)["']/g)].map((m) => m[1]);
}

const fileCache = new Map();
const sourceOf = (f) => {
  if (!fileCache.has(f)) {
    try { fileCache.set(f, readFileSync(f, "utf8")); } catch { fileCache.set(f, ""); }
  }
  return fileCache.get(f);
};

/**
 * Resolve a module specifier to a repository path under components/admin, or null.
 *
 * Both spellings are followed: the alias form (`@/components/admin/...`) and the
 * relative form (`./ChatPanel`, `../ui/Card`) that components use among themselves.
 * Skipping the relative ones reported 35 furniture files as unreachable when the
 * new house was in fact standing on some of them.
 */
function resolveSpec(spec, fromFile) {
  let base = null;
  if (spec.startsWith("@/")) base = spec.slice(2);
  else if (spec.startsWith(".")) {
    const parts = fromFile.split("/");
    parts.pop();
    for (const seg of spec.split("/")) {
      if (seg === "." || seg === "") continue;
      if (seg === "..") parts.pop();
      else parts.push(seg);
    }
    base = parts.join("/");
  }
  if (!base) return null;
  if (!base.startsWith("components/admin/")) return null;
  for (const candidate of [`${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** Every components/admin file reachable from a set of entry files. */
function reachableFurniture(entries) {
  const seen = new Set();
  const queue = [...entries];
  while (queue.length) {
    const current = queue.pop();
    for (const spec of importsFrom(sourceOf(current))) {
      const resolved = resolveSpec(spec, current);
      if (resolved && !seen.has(resolved)) {
        seen.add(resolved);
        queue.push(resolved);
      }
    }
  }
  return seen;
}

const reachableFromNew = reachableFurniture(newPages);
const reachableFromOld = reachableFurniture(oldPages);

/**
 * For a file no page reaches: does anything at all import it? A furniture file with
 * zero importers anywhere is dead weight, not a migration problem — and telling the
 * two apart is what keeps the census from ordering a funeral for something in use.
 */
const allSources = [...walk("app"), ...walk("components"), ...walk("lib")]
  .filter((f) => /\.tsx?$/.test(f));
const allTexts = allSources.map((f) => [f, sourceOf(f)]);

function importersAnywhere(file) {
  const base = file.replace(/^components\//, "").replace(/\.tsx?$/, "");
  const needles = [`@/components/${base}`, `/${base}`, `./${base.split("/").pop()}`];
  return allTexts.filter(([f, text]) => f !== file && needles.some((n) => text.includes(n))).length;
}

const furniture = furnitureFiles.map((f) => {
  const inNew = reachableFromNew.has(f);
  const inOld = reachableFromOld.has(f);
  const usedBy = inNew && inOld ? "both" : inNew ? "new-only" : inOld ? "old-only" : "unreachable";
  return {
    id: f,
    lines: linesOf(f),
    usedBy,
    importersAnywhere: usedBy === "unreachable" ? importersAnywhere(f) : undefined,
  };
});

const atoms = [
  ...oldPages.map((f) => ({ kind: "old-page", id: f, lines: linesOf(f) })),
  ...newPages.map((f) => ({ kind: "new-page", id: f, lines: linesOf(f) })),
  ...adminOnlyDoors.map((f) => ({ kind: "admin-door", id: f, resource: doorResource(f) })),
  ...furniture.map((f) => ({ kind: "furniture", id: f.id, lines: f.lines, usedBy: f.usedBy })),
  ...opsFiles.map((f) => ({ kind: "swarm-file", id: f, lines: linesOf(f) })),
  ...crons.map((c) => ({ kind: "cron", id: c.path, schedule: c.schedule })),
  ...navHrefs.map((h) => ({ kind: "nav-entry", id: h })),
];

const counts = {
  oldPages: oldPages.length,
  oldPageLines: oldPages.reduce((a, f) => a + linesOf(f), 0),
  newPages: newPages.length,
  newPageLines: newPages.reduce((a, f) => a + linesOf(f), 0),
  adminDoors: adminOnlyDoors.length,
  allDoors: adminDoors.length,
  furnitureFiles: furnitureFiles.length,
  furnitureLines: furniture.reduce((a, f) => a + f.lines, 0),
  furnitureUsedByBoth: furniture.filter((f) => f.usedBy === "both").length,
  furnitureBothLines: furniture.filter((f) => f.usedBy === "both").reduce((a, f) => a + f.lines, 0),
  furnitureNewOnly: furniture.filter((f) => f.usedBy === "new-only").length,
  furnitureOldOnly: furniture.filter((f) => f.usedBy === "old-only").length,
  furnitureUnreachable: furniture.filter((f) => f.usedBy === "unreachable").length,
  swarmFiles: opsFiles.length,
  swarmFileLines: opsFiles.reduce((a, f) => a + linesOf(f), 0),
  crons: crons.length,
  navEntries: navHrefs.length,
  duplicatedAdminLeaves: duplicatedLeaves(adminOnlyDoors).length,
  duplicatedDoorLeavesAll: duplicatedLeaves(adminDoors).length,
  atoms: atoms.length,
};

mkdirSync("docs/ledger", { recursive: true });
writeFileSync(
  "docs/ledger/census.json",
  JSON.stringify({ generatedAt: new Date().toISOString(), counts, duplicatedDoors: duplicatedLeaves(adminOnlyDoors), atoms }, null, 2),
  "utf8",
);

console.log(JSON.stringify(counts, null, 2));
console.log(`wrote docs/ledger/census.json (${atoms.length} atoms)`);
