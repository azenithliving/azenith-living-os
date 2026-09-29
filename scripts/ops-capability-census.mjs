// Read-only capability census: what can the owner actually DO, not what URLs exist.
// A capability is a thing you click, a tab you switch, a panel that opens, or a tool
// only the chat can call. None of those have a link to open — which is exactly the
// hole the file-based fence leaves.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const norm = (p) => p.split("\\").join("/");
const walk = (d, acc = []) => {
  if (!statSync(d, { throwIfNoEntry: false })?.isDirectory()) return acc;
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(norm(p));
  }
  return acc;
};
const src = (root, re) => walk(root).filter((f) => re.test(f));

// Arabic label of a control: the text the owner reads on it.
const labelsOf = (t) => {
  const out = new Set();
  for (const m of t.matchAll(/>([^<>{}]{3,60})</g)) {
    const text = m[1].trim();
    if (/[\u0600-\u06FF]/.test(text) && !/^\s*$/.test(text)) out.add(text.replace(/\s+/g, " "));
  }
  for (const m of t.matchAll(/["'`]([^"'`\n]{3,60})["'`]/g)) {
    const text = m[1].trim();
    if (/[\u0600-\u06FF]/.test(text)) out.add(text.replace(/\s+/g, " "));
  }
  return out;
};

const surfaces = [...src("app/admin", /\.tsx?$/), ...src("components/admin", /\.tsx?$/)];
let clicks = 0;
let panels = 0;
let tabs = 0;
const perSurface = [];
for (const f of surfaces) {
  const t = readFileSync(f, "utf8");
  const c = (t.match(/onClick=/g) || []).length;
  const p = (t.match(/\{[^{}]{0,120}&&\s*\(/g) || []).length;
  const tb = (t.match(/setTab\(|activeTab|setActiveTab\(/g) || []).length;
  clicks += c;
  panels += p;
  tabs += tb;
  if (c > 0) perSurface.push({ f, clicks: c, panels: p, labels: [...labelsOf(t)].slice(0, 4) });
}

// Tools: capabilities with no screen at all — only the swarm's chat can call them.
const toolFiles = src("lib/agent-tools", /\.ts$/);
const toolIds = new Set();
for (const f of toolFiles) {
  for (const m of readFileSync(f, "utf8").matchAll(/name:\s*["']([a-z0-9_]+)["']/g)) toolIds.add(m[1]);
}

console.log(`screens+parts scanned: ${surfaces.length}`);
console.log(`things you can press (onClick): ${clicks}`);
console.log(`panels that open in place (conditional render): ${panels}`);
console.log(`tab switches: ${tabs}`);
console.log(`tools with no screen (chat-only): ${toolIds.size}`);
console.log(`\nURLs the old+new house actually has: ${new Set(surfaces.filter((f) => f.endsWith("page.tsx")).map((f) => f.replace("/page.tsx", ""))).size}`);
console.log("\nthe ten busiest surfaces by presses:");
for (const s of [...perSurface].sort((a, b) => b.clicks - a.clicks).slice(0, 10)) {
  console.log(`  ${s.f.padEnd(52)} press=${String(s.clicks).padStart(3)} panels=${String(s.panels).padStart(3)}  ${s.labels.join(" | ")}`);
}
