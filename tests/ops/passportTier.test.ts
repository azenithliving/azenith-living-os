import { describe, expect, it } from "vitest";

import { SENSITIVE_PATHS, shouldRateLimit } from "@/lib/rate-limit";

/**
 * Which ceiling a stranger's request falls under, counted the way a family actually uses the sheet.
 *
 * The customer's page asks for the vote tally every twenty seconds while it is the window he is
 * looking at. Six phones on one home connection is eighteen reads a minute before anybody taps
 * anything — and the sensitive tier is twenty a minute. Putting a read behind a write's ceiling is
 * how a family room starts answering «المتجر ما ردّش» in the middle of a decision.
 */
const TOKEN = "abcdefghij_klmnop123456";
const sheet = `/api/passport/${TOKEN}`;

describe("reads and writes do not share one ceiling", () => {
  it("keeps every write behind the strict door", () => {
    for (const path of [`${sheet}/votes`, `${sheet}/plan`, `${sheet}/contact`, sheet]) {
      expect(shouldRateLimit(path, "POST"), path).toEqual({ shouldLimit: true, isSensitive: true });
    }
  });

  it("gives the sheet's own reads the general door", () => {
    for (const path of [`${sheet}/votes`, sheet]) {
      expect(shouldRateLimit(path, "GET"), path).toEqual({ shouldLimit: true, isSensitive: false });
    }
  });

  it("fits a family of six polling every twenty seconds inside the tier they get", () => {
    const perMinutePerPhone = 60 / 20;
    const familyOnOneConnection = perMinutePerPhone * 6;
    const GENERAL_TIER = 100;
    expect(familyOnOneConnection).toBeLessThan(GENERAL_TIER);
    expect(shouldRateLimit(`${sheet}/votes`, "GET").isSensitive).toBe(false);
  });

  it("still limits the read — it is not made public and uncounted", () => {
    expect(shouldRateLimit(`${sheet}/votes`, "GET").shouldLimit).toBe(true);
  });

  it("leaves the other doors exactly where they were", () => {
    expect(shouldRateLimit("/api/enhance-image", "POST").isSensitive).toBe(true);
    expect(shouldRateLimit("/api/pexels", "GET")).toEqual({ shouldLimit: true, isSensitive: false });
    expect(shouldRateLimit("/rooms", "GET").shouldLimit).toBe(false);
    for (const path of SENSITIVE_PATHS) expect(path.startsWith("/api/")).toBe(true);
  });

  it("treats an unknown verb on a sensitive path as a write", () => {
    // A method the door does not know is not a reason to hand it the looser ceiling.
    expect(shouldRateLimit(sheet, "DELETE").isSensitive).toBe(true);
    expect(shouldRateLimit(sheet).isSensitive).toBe(true);
  });
});
