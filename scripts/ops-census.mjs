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

/**
 * The fence the first census left open. It counted the admin doors only, but the
 * admin surfaces call doors outside /api/admin and stand on library files at the
 * library root — and a machine nobody counted is exactly the forgotten nail the
 * owner asked to see. Both are collected here, by measurement of what the admin
 * surfaces actually import, not by name.
 */
const adminTree = [...walk("app/admin"), ...walk("components/admin")].filter((f) => /\.tsx?$/.test(f));
const callerSources = [...adminTree, ...adminOnlyDoors];
const callerTexts = callerSources.map((f) => [f, sourceOf(f)]);

/** Is `/api/x` called, without letting it match the longer `/api/x/faq`? */
function calledAs(spec) {
  return callerTexts.filter(([, text]) => {
    let at = text.indexOf(spec);
    while (at !== -1) {
      const next = text[at + spec.length];
      if (next === undefined || !/[A-Za-z0-9_\-/.]/.test(next)) return true;
      at = text.indexOf(spec, at + spec.length);
    }
    return false;
  }).length;
}

const outsideDoors = adminDoors.filter((f) => !f.startsWith("app/api/admin/"));
const calledDoors = outsideDoors
  .map((f) => ({ file: f, callers: calledAs(`/api/${doorResource(f)}`) }))
  .filter((d) => d.callers > 0);

const rootLib = walk("lib").filter((f) => /\.ts$/.test(f) && f.split("/").length === 2);
const usedLib = rootLib
  .map((f) => {
    const frag = `@/lib/${f.replace("lib/", "").replace(/\.ts$/, "")}`;
    const callers = callerTexts.filter(([, text]) =>
      text.includes(`${frag}"`) || text.includes(`${frag}'`)).length;
    return { file: f, callers };
  })
  .filter((l) => l.callers > 0);

const atoms = [
  ...oldPages.map((f) => ({ kind: "old-page", id: f, lines: linesOf(f) })),
  ...newPages.map((f) => ({ kind: "new-page", id: f, lines: linesOf(f) })),
  ...adminOnlyDoors.map((f) => ({ kind: "admin-door", id: f, resource: doorResource(f) })),
  ...calledDoors.map((d) => ({ kind: "outside-door", id: d.file, lines: linesOf(d.file), callers: d.callers })),
  ...usedLib.map((l) => ({ kind: "root-lib", id: l.file, lines: linesOf(l.file), callers: l.callers })),
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
  outsideDoors: calledDoors.length,
  outsideDoorLines: calledDoors.reduce((a, d) => a + linesOf(d.file), 0),
  rootLibFiles: rootLib.length,
  rootLibUsed: usedLib.length,
  rootLibUsedLines: usedLib.reduce((a, l) => a + linesOf(l.file), 0),
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
writeFileSync(  "docs/ledger/census.json",
  JSON.stringify({ generatedAt: new Date().toISOString(), counts, duplicatedDoors: duplicatedLeaves(adminOnlyDoors), atoms }, null, 2),
  "utf8",
);

/**
 * The transfer ledger — one row per atom, generated. Only the states are written by
 * hand (`docs/ledger/movements.json`); everything else is `not-moved`. The owner's
 * badge on the old screen reads this file, so a row here that names nothing in the
 * census, or a state off the four, stops the generation instead of quietly lying.
 */
const movementsPath = "docs/ledger/movements.json";
const STATES = ["not-moved", "moving", "moved", "erased"];
let rows = atoms.map((a) => ({ atom: a.id, kind: a.kind, state: "not-moved" }));
const problems = [];
if (existsSync(movementsPath)) {
  const movements = JSON.parse(readFileSync(movementsPath, "utf8"));
  const known = new Set(movements.states ?? STATES);
  const ids = new Set(atoms.map((a) => a.id));
  const seen = new Set();
  const byId = new Map();
  for (const row of movements.rows ?? []) {
    if (!ids.has(row.atom)) problems.push(`row names an atom the census does not have: ${row.atom}`);
    if (!known.has(row.state)) problems.push(`state off the four: ${row.atom} -> ${row.state}`);
    if (seen.has(row.atom)) problems.push(`two rows for the same atom: ${row.atom}`);
    seen.add(row.atom);
    byId.set(row.atom, row);
  }
  rows = atoms.map((a) => ({ kind: a.kind, ...(byId.get(a.id) ?? { atom: a.id, state: "not-moved" }) }));
} else {
  problems.push("docs/ledger/movements.json is missing — the ledger would claim nothing has moved");
}

const ledgerCounts = rows.reduce((acc, r) => ({ ...acc, [r.state]: (acc[r.state] ?? 0) + 1 }), {});
writeFileSync(
  "docs/ledger/transfers.json",
  JSON.stringify(
    { generatedAt: new Date().toISOString(), states: STATES, counts: ledgerCounts, rows },
    null,
    2,
  ),
  "utf8",
);

console.log(JSON.stringify(counts, null, 2));
console.log(`wrote docs/ledger/census.json (${atoms.length} atoms)`);
console.log(`wrote docs/ledger/transfers.json (${rows.length} rows: ${JSON.stringify(ledgerCounts)})`);

if (problems.length > 0) {
  for (const p of problems) console.error(`LEDGER PROBLEM: ${p}`);
  process.exitCode = 1;
}
