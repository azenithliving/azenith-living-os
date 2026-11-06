// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The ledger's own timestamps are written by hand in his digits, and hand-written Arabic-Indic
 * numbers drop a digit under bidi — measured twice in one day (a result line said «١٢ من ١٢» for 11,
 * and a header said year «٢٠٢»). The header is how any agent finds *when* a claim was made, so a
 * malformed one is a broken record, not a typo.
 */
const toLatin = (text: string) => text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));

const minutes = readFileSync("docs/ledger/council-minutes.md", "utf8");

describe("the ledger's entry headers", () => {
  it("every recorded entry carries a date and a time", () => {
    const headers = [...minutes.matchAll(/\*\*الوكيل \(([^)]+)\):\*\*/g)].map((m) => toLatin(m[1]).trim());
    expect(headers.length).toBeGreaterThan(10);
    for (const header of headers) {
      expect(header, header).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
      expect(Number.isNaN(Date.parse(header.replace(" ", "T"))), header).toBe(false);
    }
  });

  it("no recorded entry is dated outside the years this store has existed", () => {
    const years = [...minutes.matchAll(/\*\*الوكيل \(([٠-٩]{4})/g)]
      .map((m) => Number(toLatin(m[1])))
      .filter((year) => Number.isFinite(year));
    expect(years.length).toBeGreaterThan(10);
    for (const year of years) expect(year).toBeGreaterThanOrEqual(2026);
  });
});
