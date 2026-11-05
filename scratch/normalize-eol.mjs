import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const files = process.argv.slice(2);
if (files.length === 0) throw new Error("pass the files to normalize");

for (const file of files) {
  const head = execFileSync("git", ["show", `HEAD:${file}`], { maxBuffer: 64 * 1024 * 1024 });
  const headText = head.toString("utf8");
  const headCrlf = (headText.match(/\r\n/g) ?? []).length;
  const headLf = (headText.match(/(?<!\r)\n/g) ?? []).length;
  const wantCrlf = headCrlf > 0 && headCrlf >= headLf;

  const current = readFileSync(file, "utf8");
  const curCrlf = (current.match(/\r\n/g) ?? []).length;
  const curLf = (current.match(/(?<!\r)\n/g) ?? []).length;
  const target = wantCrlf ? "\r\n" : "\n";
  const normalized = current.replace(/\r\n/g, "\n").replace(/\n/g, target);

  writeFileSync(file, normalized, "utf8");
  console.log(
    `${file} head(crlf=${headCrlf},lf=${headLf}) before(crlf=${curCrlf},lf=${curLf}) -> ${target === "\r\n" ? "crlf" : "lf"}`
  );
}
