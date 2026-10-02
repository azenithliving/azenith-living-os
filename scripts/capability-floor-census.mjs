/**
 * capability-floor-census.mjs — who calls a model, and what the owner sees when none answers.
 *
 * The owner's law: everything the dashboard does that needs intelligence keeps working with zero
 * keys. `lib/ops/capability-tiers.ts` declares the floors; this instrument measures which calling
 * surfaces actually fall to one. It is a classifier over source text, not a runtime probe: it
 * answers «where does a failure end up», and every row it flags is then read by a human.
 *
 * The same net is exported so `tests/ops/modelFloorDoors.test.ts` can fence on it: two patterns
 * that drift are how a model door ends up unnamed in both places.
 *
 * Usage: node scripts/capability-floor-census.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const ROOTS = ["app", "lib", "components", "services"];

/** Every way this store reaches a model: the named askers, the chain, the raw hosts. */
export const MODEL_CALL = new RegExp(
  [
    "\\bask[A-Za-z]*\\(", // askGroq, askVisionAny, askWithFloor, askOrchestratorMessages, …
    "\\b(generateText|streamText|callModel|runAgent|orchestrate|processWithMastermind|runMastermind)\\b",
    "aiOrchestrator\\.",
    "api\\.groq\\.com|openrouter\\.ai|generativelanguage\\.googleapis\\.com",
    "api\\.together\\.xyz|api\\.cerebras\\.net|api\\.anthropic\\.com|api\\.openai\\.com",
    "api\\.nvidia\\.com|api\\.chutes\\.ai|api\\.mistral\\.ai|api\\.deepseek\\.com",
    "api\\.sambanova\\.ai|api\\.cohere\\.com|api\\.aimlapi\\.com|api\\.bytez\\.com|chutes\\.ai",
  ].join("|")
);

/** What it means for a caller to fall to a declared floor instead of its own prose. */
export const FLOOR_IMPORT = /askWithFloor|modelFloorLine|capability-tiers|NO_KEY_MESSAGE|QUOTA_MESSAGE|ALL_PROVIDERS_MESSAGE/;

const ARABIC = /\p{Script=Arabic}/u;

function sources(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.(ts|tsx)$/.test(entry) && !entry.includes(".test.") ? [full] : [];
  });
}

const clean = (file) => relative(process.cwd(), file).replace(/\\/g, "/");

/** The text a caller shows when the model throws: the catch region, read for its answer. */
function catchRegions(src) {
  const lines = src.split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/\bcatch\b/.test(lines[i])) continue;
    out.push(lines.slice(i, Math.min(lines.length, i + 14)).join("\n"));
  }
  return out;
}

export function scanModelCallers(roots = ROOTS) {
  return roots
    .flatMap((root) => sources(root))
    .map((file) => {
      const src = readFileSync(file, "utf8");
      if (!MODEL_CALL.test(src)) return null;
      const path = clean(file);
      const regions = catchRegions(src);
      const hasCatch = regions.length > 0;
      const anyArabic = regions.some((r) => ARABIC.test(r));
      const swallowed = regions.some((r) => /return\s+(null|\[\]|\{\}|undefined|false)\s*;/.test(r)) && !anyArabic;
      const rethrows = regions.some((r) => /throw\b/.test(r));
      const verdict = FLOOR_IMPORT.test(src)
        ? "floor"
        : anyArabic
          ? "arabic-by-hand"
          : rethrows
            ? "rethrows"
            : swallowed
              ? "silent"
              : hasCatch
                ? "english"
                : "unknown";
      const surface = /^app\/api\/admin\//.test(path)
        ? "owner-door"
        : /^app\/api\//.test(path)
          ? "customer-door"
          : /^components\//.test(path)
            ? "screen"
            : "machine";
      return { file: path, lines: src.split("\n").length, verdict, surface, hasCatch, wired: FLOOR_IMPORT.test(src) };
    })
    .filter(Boolean);
}

/** Doors and screens a human opens — the pile the fence keeps shrinking. */
export function scanModelDoors(root = "app/api") {
  return scanModelCallers([root]).filter((row) => row.surface !== "machine");
}

function report() {
  const rows = scanModelCallers();
  const order = ["floor", "arabic-by-hand", "rethrows", "silent", "english", "unknown"];
  const counts = Object.fromEntries(order.map((v) => [v, rows.filter((r) => r.verdict === v).length]));

  console.log("A model caller answers in one of these ways when no key is left:\n");
  for (const verdict of order) {
    const list = rows.filter((r) => r.verdict === verdict);
    if (!list.length) continue;
    console.log(`== ${verdict} (${list.length})`);
    for (const r of list.sort((a, b) => b.lines - a.lines)) {
      console.log(`   ${r.surface.padEnd(13)} ${String(r.lines).padStart(5)}  ${r.file}${r.hasCatch ? "" : "   (مفيش التقاط بيغطي الفشل)"}`);
    }
  }

  const doors = scanModelDoors();
  console.log(`\nTOTAL callers=${rows.length} byVerdict=${JSON.stringify(counts)}`);
  console.log(`DOORS AND SCREENS a human opens: ${doors.length}, wired to a floor: ${doors.filter((d) => d.wired).length}, unwired: ${doors.filter((d) => !d.wired).length}`);
  for (const d of doors.filter((row) => !row.wired)) console.log(`  UNWIRED ${d.file}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) report();
