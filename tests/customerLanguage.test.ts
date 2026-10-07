// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * The customer's own law: an Arabic sentence on a page he can stand on carries no Latin word.
 *
 * Measured on the published store 2026-10-07 (route by route at 390px): the home page, the request
 * page under both of its addresses, and the furniture catalogue all put English inside Arabic copy —
 * an eyebrow, a stage description, a currency code, a brand mark in a welcome email. The fix went to
 * the sentence's own source, and this guard is what keeps it there: the DOM census only sees the step
 * the customer happened to open, while this reads every string the customer routes can put on screen.
 *
 * What is not a violation:
 *  - a field that owns the English branch (`labelEn`, `descriptionEn`, `contentEn`, …);
 *  - markup and code — a tag, an attribute, an interpolation — which is stripped before judging;
 *  - a web address, which his own rule allows as long as it stands alone.
 */
const CUSTOMER_TREES = ["app", "components"];
const ADMIN_PARTS = [join("app", "admin"), join("app", "api", "admin"), join("components", "admin")];
const DATA_FILES = [
  "lib/site-content.ts",
  "lib/site-config.ts",
  "lib/room-design-tips.ts",
  join("lib", "cad", "paper-sketch-parser.ts"),
  join("lib", "cad", "dossier.ts"),
  join("lib", "cad", "plan.ts"),
];

function sources(): string[] {
  const walk = (dir: string): string[] => {
    if (!existsSync(dir)) return [];
    if (!statSync(dir).isDirectory()) return [dir];
    return readdirSync(dir).flatMap((e) => walk(join(dir, e)));
  };
  const code = CUSTOMER_TREES.flatMap(walk).filter(
    (f) => /\.(ts|tsx)$/.test(f) && !f.includes(".test.") && !ADMIN_PARTS.some((a) => f.includes(a)),
  );
  return [...code, ...DATA_FILES.filter((f) => existsSync(f))];
}

const ARABIC = /[\u0600-\u06FF]/;
const LATIN_WORD = /[A-Za-z]{3,}/;

/**
 * Three shapes carry text that never reaches the customer's screen: a log call, a sentence handed to
 * a model as its instructions, and the internal learnings list. They name roles and providers on
 * purpose, so the guard stays out of them — everything else is treated as something he reads.
 */
const MACHINE_ONLY_LINE = /\bconsole\.\w+\(|(?:systemContent|userContent)\s*\+?=|allLearnings\.push\(/;

/** The words the customer actually reads out of one source line, or null when the line is unreadable. */
function readStrings(line: string): { text: string; skipped: boolean }[] {
  const field = line.match(/([A-Za-z]+)\s*[:=]/)?.[1];
  if (field && /En$/.test(field)) return [];
  const out = [];
  for (const m of line.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`/g)) {
    let s = m[1] ?? m[2] ?? m[3] ?? "";
    // Unwind nested interpolations innermost-first; an opener left behind means the reader stopped.
    while (s.includes("${")) {
      const unwound = s.replace(/\$\{[^{}]*\}/g, " ");
      if (unwound === s) break;
      s = unwound;
    }
    const unreadable = s.includes("${");
    s = s.replace(/\$\{[\s\S]*$/g, " ").replace(/<[^>]*>/g, " ").replace(/\{[^{}]*\}/g, " ");
    out.push({ text: s.replace(/https?:\/\/\S+/g, " ").trim(), skipped: unreadable });
  }
  return out;
}

describe("the customer's pages speak only his language", () => {
  const files = sources();

  it("the judge itself sees a stray English word and stays out of the English branch", () => {
    // Without this, the suite could be green because the reader stopped reading.
    expect(readStrings('content: "بيع بالـ EGP بالجنيه"').map((s) => s.text)).toEqual(["بيع بالـ EGP بالجنيه"]);
    expect(readStrings('contentEn: "Sold in EGP"')).toEqual([]);
    expect(readStrings('title: "غرفة المعيشة"')).toEqual([{ text: "غرفة المعيشة", skipped: false }]);
    expect(readStrings('<p className="x">افتح لوحة الأدمن</p>').every((s) => !ARABIC.test(s.text) || !LATIN_WORD.test(s.text))).toBe(true);
  });

  it("walks the customer surface, not nothing", () => {
    // A guard that scanned no file would pass every future violation silently.
    expect(files.length, "customer-facing sources walked").toBeGreaterThan(150);
    expect(files.some((f) => f.endsWith(join("app", "page.tsx"))), "home page walked").toBe(true);
  });

  it("puts no Latin word inside an Arabic sentence", () => {
    const hits: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*|})/.test(line)) return;
        // A log line and an instruction handed to a model are read by machines, not by the customer.
        if (MACHINE_ONLY_LINE.test(line)) return;
        for (const { text } of readStrings(line)) {
          if (text && ARABIC.test(text) && LATIN_WORD.test(text)) {
            hits.push(`${file}:${i + 1} — ${text.slice(0, 80)}`);
          }
        }
      });
    }
    expect(hits, `${hits.length} سلسلة عربية تحمل كلمة لاتينية:\n${hits.join("\n")}`).toEqual([]);
  });

  it("keeps the currency and the machine keys off his sentences", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      lines.forEach((line, i) => {
        for (const { text } of readStrings(line)) {
          if (!text || !ARABIC.test(text)) continue;
          if (/\bEGP\b/.test(text)) offenders.push(`${file}:${i + 1} كود عملة — ${text.slice(0, 60)}`);
          if (/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/.test(text))
            offenders.push(`${file}:${i + 1} مفتاح آلة — ${text.slice(0, 60)}`);
        }
      });
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
