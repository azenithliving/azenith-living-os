import fs from "node:fs";
import path from "node:path";

/**
 * Which model doors does anything actually call, and which of those name a floor?
 * Read-only census over the repository.
 */
const doors = [
  "app/api/admin/agent/smart/route.ts",
  "app/api/admin/agent/ultimate/route.ts",
  "app/api/admin/agents/messages/route.ts",
  "app/api/admin/ai/health/route.ts",
  "app/api/admin/architect/command/route.ts",
  "app/api/admin/arsenal/route.ts",
  "app/api/admin/assistant/route.ts",
  "app/api/admin/knowledge/audit/route.ts",
  "app/api/admin/leads/analyze/route.ts",
  "app/api/admin/leads/follow-up/route.ts",
  "app/api/admin/leads/suggestions/route.ts",
  "app/api/admin/mastermind/chat/route.ts",
  "app/api/admin/ops/vision/route.ts",
  "app/api/ai/analyze-vision/route.ts",
  "app/api/analyze-image/route.ts",
  "app/api/consultant/catalog-crawler/route.ts",
  "app/api/consultant/learnings/route.ts",
  "app/api/consultant/pending-questions/route.ts",
  "app/api/consultant/route.ts",
  "app/api/omnipotent/ai/synthesize/route.ts",
  "app/api/omnipotent/route.ts",
  "app/api/orchestrator/route.ts",
];

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (".next node_modules .git scratch".split(" ").includes(e.name)) continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(e.name) && !full.includes(".test.")) out.push(full);
  }
  return out;
};

const sources = walk("app").concat(walk("components"), walk("lib"));
// Windows paths come out of readdir with backslashes; the door list uses forward ones. Comparing
// them un-normalised silently made every door look unfloored.
const bodies = new Map(sources.map((f) => [f.replace(/\\/g, "/"), fs.readFileSync(f, "utf8")]));

const rows = doors.map((door) => {
  const url = "/" + door.replace(/^app\//, "").replace(/\/route\.ts$/, "");
  const callers = [...bodies].filter(([f, b]) => f !== door && b.includes(url)).map(([f]) => f);
  const text = bodies.get(door) ?? "";
  if (!text) throw new Error(`the census read nothing for ${door} — a blank read is not a negative`);
  // The first pass looked only for `modelFloorLine` and missed a door that asks the chain through
  // `askWithFloor` and answers with `floorLine` — an instrument that reports a floorless door
  // where the floor is wired is worse than no instrument.
  const floored = /modelFloorLine|NO_KEY_MESSAGE|ALL_PROVIDERS_MESSAGE|capability-tiers|askWithFloor|floorLine/.test(text);
  const mentionsNoKey = /مفيش مفتاح|بصفر مفتاح|غير متاح|ما بيخترعش/.test(text);
  return { url, callers: callers.length, floored, mentionsNoKey, sample: callers.slice(0, 2) };
});

const noFloor = rows.filter((r) => !r.floored && !r.mentionsNoKey);
console.log("doors reaching a model:", rows.length);
console.log("with a named floor:", rows.filter((r) => r.floored || r.mentionsNoKey).length);
console.log("called by something:", rows.filter((r) => r.callers > 0).length);
console.log("\n-- unfloored AND called (the ones a human can land on) --");
for (const r of rows.filter((x) => !x.floored && !x.mentionsNoKey && x.callers > 0))
  console.log(`${r.url} · callers ${r.callers} · ${r.sample.join(", ")}`);
console.log("\n-- unfloored and orphaned --");
for (const r of noFloor.filter((x) => x.callers === 0)) console.log(r.url);
