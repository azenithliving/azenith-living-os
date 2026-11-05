// @vitest-environment node
import { describe, it, expect } from "vitest";

import { DEAD_VERDICTS, formatDeadLine, labelOfVerdict, scheduledByCron, verdictOf } from "@/lib/build/dead-map";

/**
 * M1 classifies what is dead; it never erases it. The owner's brake says a delete is his word, so
 * the only honest output for a door nobody calls is a verdict with a reason — and a verdict that
 * cannot be derived from measured facts is left named as «لسه ما اتصنفش» instead of being guessed.
 */
describe("the dead map", () => {
  it("offers exactly the four verdicts the brake allows, with the owner's outranking the rest", () => {
    expect([...DEAD_VERDICTS].map((v) => v.id).sort()).toEqual([
      "needs-verdict",
      "owner-word",
      "repair",
      "retire",
    ]);
    // First match wins in verdictOf, so money has to be the first entry or a money door gets repaired.
    expect(DEAD_VERDICTS[0].id).toBe("owner-word");
    for (const verdict of DEAD_VERDICTS) expect(/[A-Za-z]/.test(verdict.label)).toBe(false);
  });

  it("sends a door that touches money to the owner, whatever else is true about it", () => {
    expect(verdictOf({ id: "app/api/admin/sales/orders/route.ts", writes: true, money: true, twin: true, retired: false }))
      .toBe("owner-word");
  });

  it("retires a door that stands on a retired surface", () => {
    expect(verdictOf({ id: "app/api/admin/qayyim/mind/route.ts", writes: false, money: false, twin: false, retired: true }))
      .toBe("retire");
  });

  it("repairs a door whose resource still answers from a live surface", () => {
    expect(verdictOf({ id: "app/api/admin/agents/tasks/route.ts", writes: false, money: false, twin: true, retired: false }))
      .toBe("repair");
  });

  it("names what it cannot decide instead of guessing", () => {
    // A door with no live twin and no retired surface has no evidence either way.
    expect(verdictOf({ id: "app/api/admin/unknown/thing/route.ts", writes: false, money: false, twin: false, retired: false }))
      .toBe("needs-verdict");
  });

  it("retires a door whose tables the record does not have", () => {
    // Measured evidence, not a guess: the door names tables, and none of them exist in the migrations.
    expect(verdictOf({
      id: "app/api/reality/check/route.ts",
      writes: false,
      money: false,
      twin: false,
      retired: false,
      tableMissing: true,
    })).toBe("retire");
  });

  it("keeps a live twin above a missing table only when the door still answers something", () => {
    // Priority is money, then retirement (its own or a dead table), then repair, then the named gap.
    expect(verdictOf({ id: "x", writes: true, money: true, twin: true, retired: false, tableMissing: true })).toBe("owner-word");
    expect(verdictOf({ id: "x", writes: false, money: false, twin: true, retired: false, tableMissing: true })).toBe("retire");
  });

  it("never lets a missing fact read as a verdict", () => {
    const noFacts = {} as Parameters<typeof verdictOf>[0];
    expect(() => verdictOf(noFacts)).toThrow(/ما اتقارش/);
  });

  it("prints the tally in his digits and refuses a placating zero", () => {
    const line = formatDeadLine({
      doors: 77,
      furniture: 18,
      counts: { repair: 40, retire: 12, "owner-word": 3, "needs-verdict": 22 },
    });
    expect(line).toContain("باب يتيم");
    expect(/[0-9]/.test(line)).toBe(false);
    expect(line).toContain("لسه ما اتصنفش");
    expect(labelOfVerdict("needs-verdict")).toBe("لسه ما اتصنفش");
  });

  it("says what is not measured when the census did not answer", () => {
    const line = formatDeadLine({ doors: null, furniture: null, counts: null });
    expect(line).toContain("ما اتقارش");
    expect(line).not.toContain("٠");
  });

  it("counts the scheduler as a caller, so a running cron door is not buried as dead", () => {
    // Measured 2026-11-05: two of the 77 «orphan» doors are listed in vercel.json and run every day.
    const cronPaths = ["/api/cron/ops-daily", "/api/cron/admin-daily-report"];
    expect(scheduledByCron("app/api/cron/ops-daily/route.ts", cronPaths)).toBe(true);
    expect(scheduledByCron("app/api/cron/monthly-refresh/route.ts", cronPaths)).toBe(false);
    expect(scheduledByCron("app/api/admin/agents/tasks/route.ts", cronPaths)).toBe(false);
  });
});
