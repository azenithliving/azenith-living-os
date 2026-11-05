import { readFileSync, writeFileSync } from "node:fs";

const file = "components/admin/agents/ChatPanel.tsx";
const text = readFileSync(file, "utf8");
const eol = text.includes("\r\n") ? "\r\n" : "\n";
const lines = text.split(/\r?\n/);

const start = lines.findIndex((l) => l.startsWith("function MarkdownContent("));
if (start === -1) throw new Error("the local renderer was not found");
const end = lines.findIndex((l, i) => i > start && l === "}");
if (end === -1) throw new Error("the local renderer has no closing brace");

const block = lines.slice(start, end + 1).join("\n");
if (!block.includes("const INLINE_LINK") || !block.includes("return <div className=\"space-y-1\">{elements}</div>;")) {
  throw new Error(`cutting the wrong range (${block.length} chars)`);
}
console.log(`cutting lines ${start + 1}..${end + 1} (${block.length} chars)`);

const kept = [...lines.slice(0, start), ...lines.slice(end + 1)];
let out = kept.join("\n");

const emphasisImport = "import { bracketListItems, isBulletLine, splitInline, stripBullet } from '@/lib/talk/emphasis';";
const placeImport = "import { chatPlaceLabel } from '@/lib/ops/draft-labels';";
if (!out.includes(emphasisImport)) throw new Error("the emphasis import line changed shape");
if (!out.includes(placeImport)) throw new Error("the place-label import line changed shape");

out = out.replace(emphasisImport, "import { MarkdownContent } from '@/components/talk/MarkdownContent';");
out = out.replace(`${placeImport}\n`, "");

if (out.includes("function MarkdownContent(")) throw new Error("the local renderer survived");
if (/[^']chatPlaceLabel\(/.test(out)) throw new Error("chatPlaceLabel is still used but its import was removed");
if (/splitInline\(/.test(out)) throw new Error("splitInline is still used but its import was replaced");

writeFileSync(file, out, "utf8");
console.log("lines before=" + lines.length + " after=" + out.split(/\r?\n/).length);
console.log("uses renderer at=" + (out.match(/<MarkdownContent /g) ?? []).length);
