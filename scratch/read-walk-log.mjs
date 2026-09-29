// Parses the walk log into totals — kept as a file because shell escaping of
// backslashes inside a one-liner produced a regex that silently matched nothing.
import { readFileSync } from "node:fs";

const lines = readFileSync(process.argv[2] ?? "scratch/screen-walk-2.log", "utf8").split("\n");
const rows = lines.filter((l) => l.includes("controls="));
const num = (l, key) => {
  const at = l.indexOf(key + "=");
  if (at < 0) return 0;
  const rest = l.slice(at + key.length + 1);
  const m = /^ *(\d+)/.exec(rest);
  return m ? Number(m[1]) : 0;
};
const sum = (key) => rows.reduce((a, r) => a + num(r, key), 0);
const dead = rows.filter((r) => num(r, "dead") > 0).map((r) => `${r.split(" ")[0]}:${num(r, "dead")}`);

console.log(`rows done: ${rows.length}`);
console.log(`controls found: ${sum("controls")}`);
console.log(`pressed: ${sum("pressed")}`);
console.log(`views opened: ${sum("views")}  unchanged address: ${sum("same-url")}`);
console.log(`dead controls: ${sum("dead")}`);
if (dead.length) console.log(`  where: ${dead.join("  ")}`);
