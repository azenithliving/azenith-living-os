import fs from "node:fs";

const path = "docs/ledger/council-minutes.md";
const title = process.argv[2];
if (!title) throw new Error("pass the title of the entry to drop");

const text = fs.readFileSync(path, "utf8");
const lines = text.split("\n");
const at = lines.findIndex((line) => line.startsWith("- **الوكيل") && line.includes(title));
if (at < 0) throw new Error("entry not found: " + title);

let end = at + 1;
while (end < lines.length && lines[end].trim() !== "" && !lines[end].startsWith("- **")) end++;

const kept = lines.slice(0, at).concat(lines.slice(end + 1));
fs.writeFileSync(path, kept.join("\n"), "utf8");
console.log("dropped lines:", end - at + 1, "file lines:", kept.length, "was:", lines.length);
