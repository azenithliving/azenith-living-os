import { readFileSync } from "node:fs";

const files = {
  shared: readFileSync("lib/ops/memory/SharedMemory.ts", "utf8"),
  brain: readFileSync("lib/ops/chat-brain.ts", "utf8"),
  round: readFileSync("lib/ops/daily-round.ts", "utf8"),
  orchestrator: readFileSync("lib/agents/AgentOrchestrator.ts", "utf8"),
  panel: readFileSync("components/admin/agents/ChatPanel.tsx", "utf8"),
  remember: readFileSync("lib/ops/memory/remember-round.ts", "utf8"),
};

const guards = {
  noFakeVector: (f) => /\.\.\.\(embedding \? \{ embedding \} : \{\}\)/.test(f.shared),
  floorNeedsNoKey: (f) => {
    const body = f.shared.slice(f.shared.indexOf("async recallText("), f.shared.indexOf("async searchSimilar("));
    return body.length > 100 && !body.includes("generateEmbedding") && body.includes("foldArabic");
  },
  recallHasFloor: (f) => f.brain.includes("recallText(") && f.brain.includes('how: "keyword"'),
  refusalSpoken: (f) => f.brain.includes("الذاكرة ما اتقريتش"),
  producerWired: (f) => f.round.includes("rememberRound(companyId, results)"),
  ownerSeesIt: (f) => f.panel.includes("data-chat-memory") && f.orchestrator.includes("metadata as any).memory"),
  nothingInvented: (f) => f.remember.includes("الجولة ما قالتش حاجة مقاسة"),
};

const keys = Object.keys(guards);
const verdict = (f) => keys.map((k) => `${k}=${guards[k](f) ? "passed" : "CAUGHT"}`).join(" ");
console.log(`clean → ${verdict(files)}`);

const mutants = {
  "an invented vector": (f) => ({ ...f, shared: f.shared.replace("...(embedding ? { embedding } : {}),", "embedding: embedding ?? new Array(768).fill(0),") }),
  "the floor asks a model": (f) => ({ ...f, shared: f.shared.replace("async recallText(", "async recallTextUnused(") }),
  "recall keeps only the semantic door": (f) => ({ ...f, brain: f.brain.replace("const text = await sharedMemory.recallText(message, { limit: 3 });", "") }),
  "the refusal is swallowed again": (f) => ({ ...f, brain: f.brain.replace("الذاكرة ما اتقريتش", "مفيش حاجة") }),
  "the producer never runs": (f) => ({ ...f, round: f.round.replace("rememberRound(companyId, results)", "void results") }),
  "the owner is told nothing": (f) => ({ ...f, panel: f.panel.replace("data-chat-memory=", "data-hidden=") }),
  "an unmeasured step becomes a zero": (f) => ({ ...f, remember: f.remember.replace("الجولة ما قالتش حاجة مقاسة", "خلاص") }),
};

for (const [name, edit] of Object.entries(mutants)) {
  const mutated = edit(files);
  const changed = JSON.stringify(mutated) !== JSON.stringify(files);
  console.log(`${name} (edit landed: ${changed ? "yes" : "NO — dud"}) → ${verdict(mutated)}`);
}
