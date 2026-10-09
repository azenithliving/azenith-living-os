import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The sales roll's own door: what the screen does when it does not answer.
 *   npx vitest run tests/sales-roll-failure.test.ts
 *
 * Measured 2026-10-09: the panel fetched `/api/admin/leads` every three seconds, and a refused read
 * disappeared — a non-200 was ignored with no `else`, and a thrown error went only to the browser
 * log. The owner's screen then showed zeros that read as "no customers", which is the one thing a
 * counter must never do.
 */
const panel = readFileSync("components/admin/sales/CustomersPanel.tsx", "utf8");

describe("the sales panel admits when the roll did not answer", () => {
  it("keeps a refusal from being read as an empty list", () => {
    expect(panel).toContain("setLeadsError(");
    expect(panel).toContain("!Array.isArray(data.leads)");
    // The old shape: `if (response.ok) { ... }` with no other branch, and a console-only catch.
    expect(panel).not.toContain('console.error("Failed to load leads:"');
  });

  it("says it on the screen, in his words, with the last numbers named as last-known", () => {
    expect(panel).toContain('data-leads-error="1"');
    expect(panel).toContain("مش معناه إن مفيش عملاء");
    expect(panel).not.toMatch(/data-leads-error[^>]*>\s*<p[^>]*>\{[a-z]+\.message\}/);
  });

  it("asks the door without a cached answer", () => {
    expect(panel).toContain('fetch("/api/admin/leads", { cache: "no-store" })');
  });
});
