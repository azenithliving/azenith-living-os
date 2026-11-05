import fs from "node:fs";

/**
 * The amending clause I just wrote into the instruction file carried an English word inside an
 * Arabic sentence — the exact defect this session has been fixing on the owner's screens. This
 * removes it and then scans the whole inserted section for any other Latin run before it ships.
 */
const path = "AGENTS.md";
let s = fs.readFileSync(path, "utf8");
const from = "واللي يفضل واقف waiting هو";
const to = "واللي يفضل واقف ومستنى الكلمة الصريحة هو";
if (!s.includes(from)) throw new Error("the clause is not where it was written — refusing");
s = s.replace(from, to);

const start = s.indexOf("**تفويض المالك الدائم");
const end = s.indexOf("ما اتنقصش منها حرف.");
const section = s.slice(start, end);
const latin = [...new Set(section.match(/[A-Za-z]{2,}/g) ?? [])];
if (latin.length) throw new Error(`the authority section still carries Latin runs: ${latin.join(" ")}`);

fs.writeFileSync(path, s);
console.log("fixed; latin runs in the section:", latin.length);
