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
const classifier = readFileSync("lib/admin-intent-classifier.ts", "utf8");

/** Every string literal the watcher can show a human: problem, cause, fix, recommendation. */
function userFacingLiterals(source: string): string[] {
  const out: string[] = [];
  const re = /(?:problem|rootCause|proposedFix):\s*(`[^`]*`|"[^"]*")|recommendations\.push\("([^"]*)"\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) out.push((m[1] ?? m[3] ?? "").replace(/^["`]|["`]$/g, ""));
  return out;
}

describe("the watcher's alerts", () => {
  it("are all read, and there are enough of them to trust the check", () => {
    const found = userFacingLiterals(sentinel);
    expect(found.length).toBeGreaterThanOrEqual(11);
  });

  it("carry no English sentence", () => {
    for (const line of userFacingLiterals(sentinel)) {
      // `${...}` is code that fills the sentence in (an Arabic name, a number in his digits);
      // the prose around it is what must not be English.
      const prose = line.replace(/\$\{[^}]*\}/g, "");
      expect(prose, prose).not.toMatch(/[A-Za-z]{3,}/);
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
    expect(sentinel).toContain("arabicNumerals(String(errorCount))");
    expect(sentinel).toContain("arabicNumerals(percentUsed.toFixed(1))");
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
