// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { readerAbsent } from "@/lib/cad/paper-sketch-parser";

/**
 * An absent witness is not a disagreement.
 *
 * Measured 2026-10-07 on the published store: the cloud reader refused («القارئ الذكي مرفوض
 * دلوقتي (google API error: 403 …)»), the paper arrived with zero numbers, and the seal rule —
 * written to refuse a disagreement — kept the customer out of his own sheet forever. The offline
 * engine is not the rescue: across 17 stored readings it finished inside a request 0 times.
 */
describe("was there no reading at all?", () => {
  it("says yes when the reader was refused", () => {
    expect(readerAbsent({ ok: false, failure: "القارئ الذكي مرفوض دلوقتي (google API error: 403) — مفيش رقم جه من شاهد تاني" })).toBe(true);
  });

  it("says yes when the reader answered in words nobody can parse", () => {
    expect(readerAbsent({ ok: false, failure: "القارئ الذكي ردّ بصيغة مش مفهومة — مبنخترعش أرقام من رد مش مقروء" })).toBe(true);
  });

  it("says no when a reading exists and simply disagrees", () => {
    expect(readerAbsent({ ok: false, failure: "ولا رقم طابق شاهد تاني — بيتعرض اقتراح، مش منجز" })).toBe(false);
  });

  it("says no when the reading agreed", () => {
    expect(readerAbsent({ ok: true, failure: null })).toBe(false);
  });

  it("says no when there is no row to judge", () => {
    expect(readerAbsent(null)).toBe(false);
  });
});

describe("the door is wired to the difference", () => {
  const door = readFileSync("app/api/passport/[token]/route.ts", "utf8");

  it("seals on the customer's own digits only when the reader was absent", () => {
    expect(door).toContain("readerAbsent(row)");
    expect(door).toContain('sealedBy: "customer-only"');
  });

  it("tells the customer which witness sealed his paper", () => {
    expect(door).toContain("الورقة اتقفلت على مقاساتك");
    expect(door).toContain("القارئ الذكي كان مرفوض");
  });
});
