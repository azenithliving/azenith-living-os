// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The site watcher's sentences are his sentences.
 *
 * Measured 2026-10-10: `lib/sentinel.ts` wrote its alerts in English and dropped an exception
 * message into the visible field («External API error: <exception>»), and `app/admin/page.tsx`
 * fetches that door and renders the alerts on his admin home. The fix is at the source — a
 * render-time translation would leave the next alert producer free to do the same thing.
 */

const sentinel = readFileSync("lib/sentinel.ts", "utf8");
const report = readFileSync("lib/sentinel-report.ts", "utf8");
const classifier = readFileSync("lib/admin-intent-classifier.ts", "utf8");
const door = readFileSync("app/api/system-health/route.ts", "utf8");
const healthScreens = [
  readFileSync("app/admin/database/page.tsx", "utf8"),
  readFileSync("app/admin/page.tsx", "utf8"),
];

/**
 * The literals this code path can hand a human.
 *
 * A capture shaped like a single lowercase word (`return "unreadable"`) is a state tag, not prose, and
 * is dropped. The filter is deliberately shape-based and not "does it contain Arabic": filtering by
 * Arabic would make this guard blind to the exact thing it exists to catch — a sentence written
 * entirely in English.
 */
function userFacingLiterals(source: string): string[] {
  const out: string[] = [];
  const re = /(?:problem|rootCause|proposedFix|logNote|message):\s*(`[^`]*`|"[^"]*")|recommendations?\.push\("([^"]*)"\)|out\.push\("([^"]*)"\)|out\.push\(`([^`]*)`\)|return "([^"]*)";/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const value = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? "").replace(/^["`]|["`]$/g, "");
    if (!value || /^[a-z_]+$/.test(value)) continue;
    out.push(value);
  }
  return out;
}

/** Only the Arabic prose: a `${…}` is a measured number or an Arabic name filling the sentence in. */
function proseOf(literal: string): string {
  return literal.replace(/\$\{[^}]*\}/g, "");
}

describe("the watcher's alerts", () => {
  it("are all read, and there are enough of them to trust the check", () => {
    const found = [...userFacingLiterals(sentinel), ...userFacingLiterals(report), ...userFacingLiterals(door)];
    expect(found.length).toBeGreaterThanOrEqual(15);
  });

  it("carry no English sentence", () => {
    for (const line of [...userFacingLiterals(sentinel), ...userFacingLiterals(report), ...userFacingLiterals(door)]) {
      const prose = proseOf(line);
      // Latin prose is the defect; a provider's own machine id inside a measured sentence is not,
      // but the sentence must still be Arabic around it.
      expect(prose, prose).not.toMatch(/[A-Za-z]{3,}/);
    }
  });

  it("carries no character that is neither Arabic nor code", () => {
    // A CJK or Cyrillic character reaching his Arabic copy is how a translated phrase smuggles in.
    for (const file of [sentinel, report, door, ...healthScreens]) {
      for (const line of file.split("\n")) {
        const copy = (line.match(/["'`]([^"'`\n]*[\u0600-\u06FF][^"'`\n]*)["'`]/g) ?? []).join(" ");
        expect(copy, line.trim()).not.toMatch(/[\u3040-\u30FF\u4E00-\u9FFF\u0400-\u04FF]/);
      }
    }
  });

  it("never put an exception message in the sentence he reads", () => {
    expect(sentinel).not.toMatch(/(problem|rootCause|proposedFix):\s*`[^`]*\$\{error\.message\}/);
    // The detail is not lost — it stays where an operator looks for it.
    expect(sentinel).toContain("errorLog: error.stack");
  });

  it("names a provider the way he hears it, not by its machine id", () => {
    expect(sentinel).toContain('groq: "غروك"');
    expect(sentinel).toContain('google: "جوجل"');
    expect(sentinel).not.toMatch(/problem: `\$\{provider\.toUpperCase\(\)\}/);
  });

  it("counts its numbers in his digits", () => {
    expect(sentinel).toContain("arabicNumerals(String(failedCalls))");
    expect(sentinel).toContain("arabicNumerals(String(failingKeys))");
    expect(sentinel).toContain("arabicNumerals(percentUsed.toFixed(1))");
    expect(report).toContain("arabicNumerals(String(reading.pendingTotal))");
  });

  it("prints its own numbers on his screens in his digits", () => {
    // A metric card that interpolates raw Latin digits is the same defect one layer up.
    // Scoped to the alert screen: `/admin` as a whole still counts in Latin digits and is its own
    // open atom, so asserting the helper across that file would freeze a known gap as a pass.
    const databaseScreen = healthScreens[0];
    expect(databaseScreen).toContain('from "@/lib/arabic"');
    expect(databaseScreen).toContain("arabicNumerals(metrics.activeAlerts)");
    expect(databaseScreen).toContain("arabicNumerals(metrics.memoryUsagePercent)");
    expect(databaseScreen).not.toMatch(/value=\{`\$\{metrics\.(memoryUsagePercent|apiSuccessRate)\}%`\}/);
    expect(databaseScreen).not.toContain("<span>{alert.category}</span>");
  });

  it("says the model-failure line in his language too", () => {
    expect(sentinel).toContain("مقدرتش أحلّل السبب آليًا");
    expect(sentinel).not.toContain("Manual investigation required");
  });
});

describe("the intent classifier's fallback reason", () => {
  /** The sovereign panel prints this field under the proposal, so it is owner-facing copy. */
  it("is Arabic prose, not a machine tag", () => {
    expect(classifier).toContain('reasoning: "رجعنا للقاعدة لأن النموذج ما ردّش"');
    expect(classifier).not.toContain('reasoning: "orchestrator-fallback"');
  });
});
