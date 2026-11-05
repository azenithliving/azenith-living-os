import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const file = process.argv[2];
if (!file) throw new Error("pass one file");

const head = execFileSync("git", ["show", `HEAD:${file}`], { maxBuffer: 64 * 1024 * 1024 }).toString("utf8");
const current = readFileSync(file, "utf8");

const rows = (text) => text.split(/\r?\n/);
const endings = (text) => (text.match(/\r?\n/g) ?? []).map((e) => (e === "\r\n" ? "crlf" : "lf"));

const headRows = rows(head);
const headEnds = endings(head);
const curRows = rows(current);

const dominant = headEnds.filter((e) => e === "crlf").length >= headEnds.filter((e) => e === "lf").length ? "crlf" : "lf";

// Walk both files together: a row whose content matches stays on the ending HEAD gave it,
// so an insert or delete cannot drag untouched rows into the diff.
const out = [];
let h = 0;
let kept = 0;
for (const content of curRows.slice(0, -1)) {
  let end = dominant;
  if (h < headRows.length && headRows[h] === content) {
    end = headEnds[h] ?? dominant;
    if (end === "lf") kept++;
    h++;
  } else {
    let lookahead = h + 1;
    let found = -1;
    while (lookahead < headRows.length && lookahead < h + 40) {
      if (headRows[lookahead] === content) {
        found = lookahead;
        break;
      }
      lookahead++;
    }
    if (found >= 0) {
      h = found;
      end = headEnds[found] ?? dominant;
      if (end === "lf") kept++;
      h++;
    }
  }
  out.push(content + (end === "crlf" ? "\r\n" : "\n"));
}

writeFileSync(file, out.join(""), "utf8");
console.log(`${file} kept ${kept} bare-lf rows HEAD had; rows=${out.length}; dominant=${dominant}`);
