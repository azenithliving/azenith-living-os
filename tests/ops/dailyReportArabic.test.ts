// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The daily report the owner reads — and the maturity sentence inside it.
 *
 * `buildAdminDailyReport` is not only the cron's payload: `lib/admin-natural-brain.ts` returns its
 * text as a chat reply when he asks for the day. It used to open «تقرير Azenith اليومي» and carry
 * «نضج المساعد: 62/100 (advanced)» — a Latin brand, Latin numerals, and the internal name of a
 * tier shown to a man who reads Arabic. The two collaborators that reach the network and the
 * database are stubbed with Arabic of their own, so what this asserts is the composition, not the
 * weather.
 */
const counted = vi.hoisted(() => ({ n: 3 }));

vi.mock("@/lib/architect-tools", () => ({
  getSystemHealth: vi.fn(async () => ({ success: true, message: "صحة الموقع تمام، مفيش خطأ" })),
  getAnalyticsReport: vi.fn(async () => ({ success: true, message: "الزيادات فوق المعدل في يومين" })),
}));

vi.mock("@/lib/admin-sovereign-mind", () => ({
  listPendingAdminProposals: vi.fn(async () => Array.from({ length: counted.n }, (_, i) => ({ id: `p${i}` }))),
}));

const { buildAdminDailyReport } = await import("@/lib/admin-daily-report");
const evolution = await import("@/lib/admin-capability-evolution");
const { arNum } = await import("@/lib/ops/metricLabels");

beforeEach(() => {
  counted.n = 3;
});

describe("the maturity sentence is his Arabic", () => {
  const report = evolution.getCapabilityMaturityReport();

  it("owns one Arabic name for each tier", () => {
    expect(Object.keys(evolution)).toContain("TIER_LABELS_AR");
    const labels = (evolution as unknown as { TIER_LABELS_AR: Record<string, string> }).TIER_LABELS_AR;
    for (const tier of ["foundational", "operational", "advanced", "sovereign"]) {
      expect(labels?.[tier], tier).toMatch(/\p{Script=Arabic}/u);
      expect(labels?.[tier], tier).not.toMatch(/[A-Za-z0-9]/);
    }
  });

  it("names the tier in the sentence by its Arabic name", () => {
    expect(report.summaryAr).toMatch(/تحت التأسيس|شغّال|متقدّم/);
    for (const english of ["foundational", "operational", "advanced", "sovereign"]) {
      expect(report.summaryAr, english).not.toContain(english);
    }
  });

  it("carries no Latin letter and no Latin digit", () => {
    expect(report.summaryAr.match(/[A-Za-z0-9]/g) ?? []).toEqual([]);
  });
});

describe("the daily report he reads", () => {
  it("carries no Latin letter and no Latin digit anywhere in its text", async () => {
    const report = await buildAdminDailyReport();
    const hits = report.fullTextAr.match(/[A-Za-z0-9]/g) ?? [];
    expect(hits, report.fullTextAr.slice(0, 160)).toEqual([]);
  });

  it("spells the brand the way he spells it", async () => {
    const report = await buildAdminDailyReport();
    expect(report.fullTextAr).toContain("أزينث");
    expect(report.fullTextAr).not.toContain("Azenith");
  });

  it("counts what waits for him in his numerals", async () => {
    const report = await buildAdminDailyReport();
    expect(report.fullTextAr).toContain("٣");
    expect(report.pendingApprovals).toBe(3);
  });

  it("keeps the score out of a form he cannot read", async () => {
    const report = await buildAdminDailyReport();
    expect(report.fullTextAr).not.toContain("/100");
    expect(report.fullTextAr).toMatch(/تحت التأسيس|شغّال|متقدّم/);
  });
});

/**
 * «٢٧ اقتراحات» is a number glued to a plural the way English counts it. Arabic counts the other
 * way above ten, and the report says twenty-seven today, so the word has to follow the number.
 */
describe("the count of what waits for him agrees with its word", () => {
  const cases: Array<[number, string]> = [
    [1, "اقتراح مستني"],
    [2, "اقتراحين مستنيين"],
    [3, "اقتراحات مستنية"],
    [11, "اقتراح مستني"],
    [27, "اقتراح مستني"],
  ];

  for (const [count, word] of cases) {
    it(`reads ${arNum(count)} ${word}`, async () => {
      counted.n = count;
      const report = await buildAdminDailyReport();
      expect(report.fullTextAr).toContain(`${arNum(count)} ${word}`);
    });
  }
});
