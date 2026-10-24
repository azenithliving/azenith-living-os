// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * His screens must not translate themselves into English in a bracket.
 *
 * Measured on the published dashboard 2026-10-24 (a card heading caught in a screenshot taken for
 * another proof): «ذكاء الإنتاج (Production Intel)». The Arabic already said it; the bracket was a
 * developer's note that shipped. Thirteen such glosses were counted across his admin screens —
 * «التدفق التشغيلي (Operational Flow)», «عنوان الموقع (SEO Title)», «رادار الاستشعار الحي
 * (Telemetry)» and ten more — and all thirteen were removed in this atom.
 *
 * Terms that carry no Arabic equivalent yet (SEO, Token, Hero, a product's Latin name) are a copy
 * decision, not a duplicate, and stay open as their own task. This guard is only for the shape
 * «Arabic (English restatement of the same Arabic)».
 */

const ARABIC = /[\u0600-\u06FF]/;
const GLOSS = /\(\s*[A-Za-z][A-Za-z ]{2,}\s*\)/;

function walk(dir: string): string[] {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx$/.test(full) ? [full] : [];
  });
}

/** Arabic copy a screen prints: a JSX text node, or a visible attribute. Not code, not class names. */
function visibleCopy(src: string): string[] {
  const cleaned = src
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const found: string[] = [];
  for (const m of cleaned.matchAll(/>([^<>{}]+)</g)) found.push(m[1].trim());
  for (const m of cleaned.matchAll(/(?:placeholder|title|aria-label)="([^"]*)"/g)) found.push(m[1].trim());
  // A `>` between two expressions is a comparison, not a tag: real copy is one line and carries no code.
  return found.filter((text) => ARABIC.test(text) && !/\n|;|\/\/|=>|\bconst\b/.test(text));
}

function glossedIn(file: string): string[] {
  return visibleCopy(readFileSync(file, "utf8")).filter((text) => GLOSS.test(text));
}

const adminFiles = [...walk("app/admin"), ...walk("components/admin")];

describe("his admin screens do not restate Arabic in brackets", () => {
  it("the detector sees the shape that shipped", () => {
    // A guard that cannot catch the bug it exists for is decoration (measured example, kept verbatim).
    expect(visibleCopy('<h3>ذكاء الإنتاج (Production Intel)</h3>')).toEqual(["ذكاء الإنتاج (Production Intel)"]);
    expect(glossedIn("tests/fixtures/glossedScreen.fixture.tsx")).toHaveLength(1);
  });

  it("the scan is not vacuous", () => {
    expect(adminFiles.length).toBeGreaterThan(50);
    const arabicNodes = adminFiles.reduce((sum, f) => sum + visibleCopy(readFileSync(f, "utf8")).length, 0);
    expect(arabicNodes).toBeGreaterThan(200);
  });

  it("no screen prints an English gloss next to its Arabic", () => {
    const hits = adminFiles.flatMap((f) => glossedIn(f).map((text) => `${f.replace(/\\/g, "/")}: ${text}`));
    expect(hits).toEqual([]);
  });

  it("the thirteen measured glosses are gone from their files", () => {
    const cleared = [
      "app/admin/owner-dashboard/page.tsx",
      "app/admin/sales/page.tsx",
      "components/admin/ArchitectWidget.tsx",
      "components/admin/NeuralStream.tsx",
      "components/admin/sales/CustomersPanel.tsx",
      "components/admin/SovereignPulse.tsx",
    ];
    for (const file of cleared) {
      const copy = visibleCopy(readFileSync(file, "utf8")).join("\n");
      expect(copy, file).not.toMatch(GLOSS);
    }
    expect(readFileSync("app/admin/owner-dashboard/page.tsx", "utf8")).toContain("ذكاء الإنتاج\n");
  });
});
