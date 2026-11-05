import { readFileSync } from "node:fs";

const src = readFileSync("app/api/consultant/route.ts", "utf8");

/** The same four checks the guard file makes, run against any text. */
const guards = {
  hisLinesOnly: (t) => /readContactFrom\(\s*conversationHistory\.filter\(\(m\) => m\.role === "user"\)/.test(t),
  floor: (t) => /rememberedLine \? `\$\{rememberedLine\}\\n` : ""/.test(t) && t.includes("${remembered}${buildHumanTemporaryFailureReply(language)}"),
  numberPath: (t) => /rememberedLine \? `\$\{rememberedLine\}\\n\$\{confirmation\}` : confirmation/.test(t),
  writes: (t) => t.includes("factsFromHisWords(") && t.includes("rememberForPhone("),
};

const keys = Object.keys(guards);
console.log("clean source → " + keys.map((k) => `${k}=${guards[k](src) ? "passed" : "FAILED"}`).join(" "));

const mutants = {
  "reads every line, not just his": [
    (t) => t.replace(/readContactFrom\(\s*conversationHistory\.filter\(\(m\) => m\.role === "user"\)/, 'readContactFrom(allText)'),
  ],
  "floor forgets him": [
    (t) => t.replace(/const remembered = rememberedLine[\s\S]*?buildHumanTemporaryFailureReply\(language\)\}`;/, "const fallbackReply = buildHumanTemporaryFailureReply(language);"),
  ],
  "his number gets a flat thank-you": [
    (t) => t.replace(/reply: rememberedLine \? `\$\{rememberedLine\}\\n\$\{confirmation\}` : confirmation,/, "reply: confirmation,"),
  ],
  "back to the dead preference table": [(t) => t.replace("factsFromHisWords(", "storeUserPreference(")],
};

for (const [name, edits] of Object.entries(mutants)) {
  const mut = edits.reduce((text, edit) => edit(text), src);
  const changed = mut !== src;
  const verdict = keys.map((k) => `${k}=${guards[k](mut) ? "still passed" : "CAUGHT"}`).join(" ");
  console.log(`${name} (edit landed: ${changed ? "yes" : "NO — mutant is a dud"}) → ${verdict}`);
}
