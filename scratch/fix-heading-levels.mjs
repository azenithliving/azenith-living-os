import { readFileSync, writeFileSync } from "node:fs";

/**
 * Heading levels, line by line, with the print of every line it touched.
 *
 * The audit named four places where a page jumps from a level-one heading straight to a level three
 * or four — a screen reader customer hears "third level" with no second level above it. The tag is the
 * semantics; the visual size comes from the class, so the page looks exactly the same afterwards.
 *
 * Every change is printed so the read-back is the proof, not the exit code.
 */
const targets = [
  { file: "components/RoomPageClient.tsx", line: 621, from: "<h3", to: "<h2" },
  { file: "components/RoomPageClient.tsx", line: 623, from: "</h3>", to: "</h2>" },
  { file: "components/home-page-client-fixed.tsx", line: 341, from: "<h4", to: "<h3" },
  { file: "components/home-page-client-fixed.tsx", line: 341, from: "</h4>", to: "</h3>" },
  ...[352, 385, 418, 465, 499, 543, 576, 620].flatMap((line) => [
    { file: "components/request-page-client.tsx", line, from: "<h3", to: "<h2" },
    { file: "components/request-page-client.tsx", line, from: "</h3>", to: "</h2>" },
  ]),
  ...[808, 823, 857].flatMap((line) => [
    { file: "components/request-page-client.tsx", line, from: "<h4", to: "<h3" },
    { file: "components/request-page-client.tsx", line, from: "</h4>", to: "</h3>" },
  ]),
  // This one is written across several lines, so its closing tag sits on its own.
  { file: "components/request-page-client.tsx", line: 838, from: "<h4", to: "<h3" },
  { file: "components/request-page-client.tsx", line: 842, from: "</h4>", to: "</h3>" },
];

const byFile = new Map();
for (const target of targets) {
  if (!byFile.has(target.file)) byFile.set(target.file, readFileSync(target.file, "utf8").split("\n"));
  const lines = byFile.get(target.file);
  const index = target.line - 1;
  const before = lines[index];
  if (!before || !before.includes(target.from)) {
    console.error(`MISS ${target.file}:${target.line} expected ${target.from} — got: ${String(before ?? "no line").trim().slice(0, 90)}`);
    process.exit(1);
  }
  lines[index] = before.replace(target.from, target.to);
  console.log(`${target.file}:${target.line} ${target.from} -> ${target.to}`);
}

for (const [file, lines] of byFile) writeFileSync(file, lines.join("\n"), "utf8");
console.log("written:", [...byFile.keys()].join(", "));
