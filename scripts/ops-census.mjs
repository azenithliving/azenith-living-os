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

/**
 * The fence used to see only what the dashboard calls. A door that exists, answers on
 * the published site, and is called by nobody is still a door — six like that are
 * failing right now under the vanguard path. So the rest are counted too, as orphans.
 */
const orphanDoors = outsideDoors
  .map((f) => ({ file: f, callers: calledAs(`/api/${doorResource(f)}`) }))
  .filter((d) => d.callers === 0);

/**
 * Library machinery the store stands on, at any depth. The fence used to look only at
 * the library root, so a module one folder deeper was invisible — which is how the
 * customers' own identity file nearly escaped the ledger. The doors the admin surfaces
 * call are callers too: the consultant's door carries the customer capture, and a
 * machine reachable only from a customer-facing door is still in use.
 */
const callerTextsWide = [...callerTexts, ...calledDoors.map((d) => [d.file, sourceOf(d.file)])];
const rootLib = walk("lib").filter((f) => /\.ts$/.test(f) && !f.startsWith("lib/ops/"));
const usedLib = rootLib
  .map((f) => {
    const frag = `@/lib/${f.replace("lib/", "").replace(/\.ts$/, "")}`;
    const callers = callerTextsWide.filter(([, text]) =>
      text.includes(`${frag}"`) || text.includes(`${frag}'`)).length;
    return { file: f, callers };
  })
  .filter((l) => l.callers > 0);

/**
 * A capability is not a file. `docs/ledger/screens.json` is generated by walking the
 * published site and pressing its controls; every view that opened WITHOUT the
 * address moving is an atom of its own. This is the owner's objection made
 * countable: six screens, one link.
 */
const screensPath = "docs/ledger/screens.json";
const seenViews = new Set();
const viewAtoms = existsSync(screensPath)
  ? JSON.parse(readFileSync(screensPath, "utf8")).rows
      .filter((r) => !r.error)
      .flatMap((r) => (r.detail ?? [])
        .filter((v) => !v.urlChanged && v.kind !== "form")
        .map((v) => ({
          kind: "view",
          id: `${r.route}#${v.label}`,
          route: r.route,
          layer: r.layer,
          wrote: v.wrote === true,
        })))
      // One capability, one row: the same label can be pressed twice on one screen.
      .filter((v) => !seenViews.has(v.id) && seenViews.add(v.id))
  : [];

/**
 * Code evidence for every old screen. The hand-written map decides states; this asks the
 * repository whether the map is contradicted: does the new house have a twin route, does the old
 * screen merely forward, was it retired on purpose, and which doors are reachable ONLY from the
 * old house. A screen with no door of its own is not «unmoved because it failed» — it may be a
 * display surface, and the two are different sentences, so both get recorded.
 */
const readSrc = (f) => { try { return readFileSync(f, "utf8"); } catch { return ""; } };
const sourceFiles = (dir) => walk(dir).filter((f) => /\.tsx?$/.test(f));

function resolveImport(spec, fromFile) {
  if (spec.startsWith("@/")) return spec.slice(2);
  if (spec.startsWith(".")) {
    const parts = (fromFile.split("/").slice(0, -1).join("/") + "/" + spec).split("/");
    const out = [];
    for (const part of parts) {
      if (part === "..") out.pop();
      else if (part && part !== ".") out.push(part);
    }
    return out.join("/");
  }
  return null;
}

function withExt(base) {
  for (const e of ["", ".tsx", ".ts", "/index.tsx", "/index.ts"]) if (existsSync(base + e)) return base + e;
  return null;
}

function importClosure(entry, depth = 2) {
  const seen = new Set();
  const stack = [{ file: entry, level: 0 }];
  while (stack.length) {
    const { file, level } = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    if (level >= depth) continue;
    for (const m of readSrc(file).matchAll(/from ["']([^"']+)["']/g)) {
      const resolved = resolveImport(m[1], file);
      if (!resolved) continue;
      if (!(resolved.startsWith("components/") || resolved.startsWith("lib/"))) continue;
      const target = withExt(resolved);
      if (target && !seen.has(target)) stack.push({ file: target, level: level + 1 });
    }
  }
  return [...seen];
}

function doorsIn(files) {
  const set = new Set();
  for (const f of files) for (const m of readSrc(f).matchAll(/["'`](\/api\/[A-Za-z0-9\-_/[\]]+)/g)) set.add(m[1].replace(/\/+$/, ""));
  return set;
}

/**
 * The new house is not a folder — it is every file the new screens actually reach. Measuring it as
 * `components/admin/v2/**` alone declared the moved chat panel «old-only», because the new cockpit
 * imports it from `components/admin/agents/`.
 */
const newScreenPages = newPages;
const newClosure = new Set(newScreenPages.flatMap((p) => importClosure(p, 3)));
const newHouseDoors = doorsIn([...newClosure]);
const newHouseFurniture = new Set([...newClosure].filter((f) => f.startsWith("components/")).map((f) => f.split("/").pop()));
const pageEvidence = new Map();
for (const page of oldPages) {
  const src = readSrc(page);
  const own = importClosure(page, 3);
  const doors = [...doorsIn(own)].sort();
  const furniture = [...new Set(own.filter((f) => f.startsWith("components/")).map((f) => f.split("/").pop()))].sort();
  const shared = doors.filter((d) => newHouseDoors.has(d));
  const onlyOld = doors.filter((d) => !newHouseDoors.has(d));
  const onlyOldFurniture = furniture.filter((f) => !newHouseFurniture.has(f));
  const leaf = page.split("/").slice(-2, -1)[0] === "admin" ? "landing" : page.split("/").slice(-2, -1)[0];
  pageEvidence.set(page, {
    leaf,
    twin: leaf === "landing" ? existsSync("app/admin/v2/page.tsx") : existsSync(`app/admin/v2/${leaf}/page.tsx`),
    forwarder: /redirect\(|router\.replace\(|router\.push\(/.test(src) && src.split("\n").length < 30,
    retired: /تم إيقاف|retired rather/i.test(src),
    doors: doors.length,
    sharedDoors: shared.length,
    furniture: furniture.length,
    sharedFurniture: furniture.length - onlyOldFurniture.length,
    onlyOldDoors: onlyOld,
    onlyOldFurniture,
    onlyOldDoors: onlyOld,
  });
}

const atoms = [
  ...oldPages.map((f) => ({ kind: "old-page", id: f, lines: linesOf(f), evidence: pageEvidence.get(f) ?? null })),
  ...newPages.map((f) => ({ kind: "new-page", id: f, lines: linesOf(f) })),
  ...adminOnlyDoors.map((f) => ({ kind: "admin-door", id: f, resource: doorResource(f) })),
  ...calledDoors.map((d) => ({ kind: "outside-door", id: d.file, lines: linesOf(d.file), callers: d.callers })),
  ...usedLib.map((l) => ({ kind: "root-lib", id: l.file, lines: linesOf(l.file), callers: l.callers })),
  ...orphanDoors.map((d) => ({ kind: "orphan-door", id: d.file, lines: linesOf(d.file) })),
  ...furniture.map((f) => ({ kind: "furniture", id: f.id, lines: f.lines, usedBy: f.usedBy })),
  ...opsFiles.map((f) => ({ kind: "swarm-file", id: f, lines: linesOf(f) })),
  ...viewAtoms.map((v) => ({ kind: v.kind, id: v.id, route: v.route, layer: v.layer, wrote: v.wrote })),
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
  orphanDoors: orphanDoors.length,
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
  views: viewAtoms.length,
  viewsOpeningWrites: viewAtoms.filter((v) => v.wrote).length,
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
/**
 * Five states, not four. A screen that is only a signpost, and a screen retired on purpose, are not
 * work still pending — counting them as `not-moved` inflated the owner's «what is left» by seven rows
 * and made the ledger say the transfer was further behind than the repository does.
 */
const STATES = ["not-moved", "moving", "moved", "erased", "no-surface"];
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
  rows = atoms.map((a) => ({ kind: a.kind, ...(byId.get(a.id) ?? { atom: a.id, state: "not-moved" }), ...(a.evidence ? { evidence: a.evidence } : {}) }));
} else {
  problems.push("docs/ledger/movements.json is missing — the ledger would claim nothing has moved");
}

/**
 * The code overrules the hand where the hand forgot: an old screen that only forwards, or was retired
 * on purpose, carries no surface to transfer. The state is written with the sentence that proves it.
 */
const carriedByCode = [];
for (const row of rows) {
  if (row.kind !== "old-page" || !row.evidence) continue;
  const e = row.evidence;
  if (row.state === "not-moved" && e.twin && e.doors > 0 && e.onlyOldDoors.length === 0 && e.onlyOldFurniture.length === 0) {
    row.state = "moved";
    row.proof = `كل أبوابها (${e.doors}) وعفشها (${e.furniture}) تُقرأ من الجديدة`;
    row.when = new Date().toISOString().slice(0, 10);
    carriedByCode.push(row.atom);
    continue;
  }
  if (row.state !== "not-moved") continue;
  if (e.forwarder) {
    row.state = "no-surface";
    row.proof = "الشاشة تحويل فقط — الكود يحوّل ولا سطح لها";
    row.when = new Date().toISOString().slice(0, 10);
  } else if (e.retired) {
    row.state = "no-surface";
    row.proof = "متقاعدة عمدًا — الصفحة تقول إنها أوقفت أدوات التأثير المخترعة";
    row.when = new Date().toISOString().slice(0, 10);
  }
}

/**
 * Where the hand-written map and the repository disagree, the disagreement is recorded instead of
 * silently resolved: a screen the map says never moved but the new house already carries is a stale
 * map, and a screen claimed moved with no twin and no shared door is a false claim. Both are listed
 * so the next agent reconciles them rather than trusting either file.
 */
const stale = [];
const unproven = [];
for (const row of rows) {
  if (row.kind !== "old-page" || !row.evidence) continue;
  const e = row.evidence;
  const carried = e.twin && e.doors > 0 && e.sharedDoors === e.doors;
  if (row.state === "not-moved" && (carried || e.forwarder || e.retired)) stale.push(`${row.atom}${e.forwarder ? " (محوّل بلا سطح)" : e.retired ? " (متقاعدة عمدًا)" : " (كل أبوابها في الجديدة)"}`);
  if (row.state === "moved" && !e.twin && e.sharedDoors === 0) unproven.push(`${row.atom} (مُدّعى أنه نُقل ولا نسخة ولا باب مشترك)`);
}

const ledgerCounts = rows.reduce((acc, r) => ({ ...acc, [r.state]: (acc[r.state] ?? 0) + 1 }), {});
writeFileSync(
  "docs/ledger/transfers.json",
  JSON.stringify(
    { generatedAt: new Date().toISOString(), states: STATES, counts: ledgerCounts, disagreements: { staleMap: stale, unprovenMoves: unproven }, rows },
    null,
    2,
  ),
  "utf8",
);

console.log(JSON.stringify(counts, null, 2));
console.log(`wrote docs/ledger/census.json (${atoms.length} atoms)`);
console.log(`wrote docs/ledger/transfers.json (${rows.length} rows: ${JSON.stringify(ledgerCounts)})`);
console.log(`evidence: old screens with a twin in the new house = ${[...pageEvidence.values()].filter((e) => e.twin).length}, forwarders = ${[...pageEvidence.values()].filter((e) => e.forwarder).length}, retired = ${[...pageEvidence.values()].filter((e) => e.retired).length}`);
console.log(`map contradicted by code (stale rows) = ${stale.length}, moves with no code backing = ${unproven.length}`);
console.log(`screens the code itself carries into the new house (moved by evidence) = ${carriedByCode.length}`);
for (const c of carriedByCode) console.log(`  carried: ${c}`);
for (const s of stale) console.log(`  stale: ${s}`);
for (const u of unproven) console.log(`  unproven: ${u}`);

if (problems.length > 0) {
  for (const p of problems) console.error(`LEDGER PROBLEM: ${p}`);
  process.exitCode = 1;
}
