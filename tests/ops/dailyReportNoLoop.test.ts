// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The daily report must not create the paper it counts.
 *
 * Measured on the live record 2026-11-03 (scratch/measure-approval-producer.out): the cron created
 * one waiting paper every day at 08:11 UTC — 61 of them labelled «تقرير قرار قبل الموافقة / إجراء
 * إداري» — because its condition was «there are waiting papers», and the paper it made was itself a
 * waiting paper. The pile grew by one unreadable sheet per day, forever, and nothing ever decided it.
 */

const routeSource = readFileSync("app/api/cron/admin-daily-report/route.ts", "utf8");

function stubReport(overrides: Record<string, unknown> = {}) {
  return {
    generatedAt: "2026-11-03T08:11:00.000Z",
    healthMessage: "صحة الموقع تمام",
    analyticsMessage: "أرقام آخر أسبوع تمام",
    maturitySummary: "شغّال",
    pendingApprovals: 67,
    needsReview: false,
    reviewReasons: [],
    fullTextAr: "تقرير",
    ...overrides,
  };
}

async function loadCronDoor(report: ReturnType<typeof stubReport>) {
  const createAdminProposal = vi.fn(async () => ({ success: true, requestId: "paper-1" }));
  vi.resetModules();
  vi.doMock("@/lib/cron-auth", () => ({ assertCronAuthorized: () => null }));
  vi.doMock("@/lib/admin-daily-report", () => ({
    buildAdminDailyReport: async () => report,
    persistDailyReport: async () => ({ ok: true, id: "m1" }),
  }));
  vi.doMock("@/lib/admin-sovereign-mind", () => ({ createAdminProposal }));
  const { GET } = await import("@/app/api/cron/admin-daily-report/route");
  return { GET, createAdminProposal };
}

async function loadBuilder(
  health: { success: boolean; message?: string },
  analytics: { success: boolean; message?: string },
  waiting: number | null = 2,
) {
  vi.resetModules();
  // The cron tests above mock this very module; the builder tests must run the real one.
  vi.doUnmock("@/lib/admin-daily-report");
  vi.doMock("@/lib/architect-tools", () => ({
    getSystemHealth: async () => ({ message: "صحة", ...health }),
    getAnalyticsReport: async () => ({ message: "أرقام", ...analytics }),
  }));
  vi.doMock("@/lib/admin-sovereign-mind", () => ({
    countPendingAdminProposals: async () => waiting,
  }));
  const { buildAdminDailyReport } = await import("@/lib/admin-daily-report");
  return await buildAdminDailyReport();
}

describe("the daily report's paper", () => {
  it("does not open a paper because papers are waiting", async () => {
    const { GET, createAdminProposal } = await loadCronDoor(stubReport({ pendingApprovals: 67, needsReview: false }));

    const json = await (await GET(new Request("http://localhost/api/cron/admin-daily-report") as never)).json();

    expect(createAdminProposal).not.toHaveBeenCalled();
    expect(json.proposalCreated).toBe(false);
    expect(json.pendingApprovals).toBe(67);
    expect(json.needsReview).toBe(false);
  });

  it("opens one paper when the report itself carries a failure, and says why", async () => {
    const { GET, createAdminProposal } = await loadCronDoor(
      stubReport({ needsReview: true, reviewReasons: ["صحة النظام ردّت بفشل"], proposalShape: 1 }),
    );

    const json = await (await GET(new Request("http://localhost/api/cron/admin-daily-report") as never)).json();

    expect(createAdminProposal).toHaveBeenCalledTimes(1);
    expect(json.proposalCreated).toBe(true);
    expect(json.reviewReasons).toEqual(["صحة النظام ردّت بفشل"]);
    const sent = createAdminProposal.mock.calls[0][0] as { reasoning: string; title: string };
    expect(sent.reasoning).toContain("صحة النظام ردّت بفشل");
    expect(sent.title).toContain("مراجعتك");
  });

  it("admits when the paper it tried to open was refused", async () => {
    const createAdminProposal = vi.fn(async () => ({ success: false, error: "شركة المتجر ما اتحلّتش" }));
    vi.resetModules();
    vi.doMock("@/lib/cron-auth", () => ({ assertCronAuthorized: () => null }));
    vi.doMock("@/lib/admin-daily-report", () => ({
      buildAdminDailyReport: async () => stubReport({ needsReview: true, reviewReasons: ["أرقام آخر أسبوع ما جتش"] }),
      persistDailyReport: async () => ({ ok: true, id: "m1" }),
    }));
    vi.doMock("@/lib/admin-sovereign-mind", () => ({ createAdminProposal }));
    const { GET } = await import("@/app/api/cron/admin-daily-report/route");

    const json = await (await GET(new Request("http://localhost/api/cron/admin-daily-report") as never)).json();

    expect(json.proposalCreated).toBe(false);
    expect(json.proposalError).toContain("ما اتحلّتش");
  });

  it("no longer reads the waiting pile as its own reason", () => {
    expect(routeSource).not.toMatch(/if \(report\.pendingApprovals > 0\)/);
    expect(routeSource).toContain("report.needsReview");
    expect(routeSource).toContain("proposalCreated");
  });
});

describe("what makes a report need him", () => {
  it("a healthy report needs nothing from him", async () => {
    const report = await loadBuilder({ success: true }, { success: true });

    expect(report.needsReview).toBe(false);
    expect(report.reviewReasons).toEqual([]);
    expect(report.pendingApprovals).toBe(2);
  });

  it("a failed health check names itself", async () => {
    const report = await loadBuilder({ success: false, message: "صحة: غير متاح" }, { success: true });

    expect(report.needsReview).toBe(true);
    expect(report.reviewReasons).toContain("صحة النظام ردّت بفشل");
  });

  it("missing numbers name themselves too", async () => {
    const report = await loadBuilder({ success: true }, { success: false });

    expect(report.needsReview).toBe(true);
    expect(report.reviewReasons).toContain("أرقام آخر أسبوع ما جتش");
  });

  it("counts every paper waiting for him, not a capped page", async () => {
    const report = await loadBuilder({ success: true }, { success: true }, 68);

    expect(report.pendingApprovals).toBe(68);
    expect(report.fullTextAr).toContain("٦٨");
  });

  it("admits when the count itself failed, instead of printing a calm zero", async () => {
    const report = await loadBuilder({ success: true }, { success: true }, null);

    expect(report.pendingApprovals).toBeNull();
    expect(report.fullTextAr).toContain("ما اتقاسش");
    expect(report.fullTextAr).not.toMatch(/٠ (اقتراح|اقتراحين|اقتراحات)/);
  });

  it("the builder asks the counter, not the capped list", () => {
    const builder = readFileSync("lib/admin-daily-report.ts", "utf8");

    expect(builder).toContain("countPendingAdminProposals");
    expect(builder).not.toContain("listPendingAdminProposals(50)");
  });
});

describe("a paper says what it is waiting for", () => {
  it("labels a numbers report by its numbers, not by «an admin action»", async () => {
    const { buildAdminApprovalReport } = await import("@/lib/admin-approval-report");

    const report = buildAdminApprovalReport({ kind: "analytics", analyticsDays: 7, confidence: 0.9 }, "اعرض إحصائيات آخر يوم");

    expect(report.actionLabel).toContain("أرقام");
    expect(report.actionLabel).not.toBe("إجراء إداري");
    // Caught on the published link 2026-11-03: the label printed «آخر 7 يوم» in Latin digits.
    expect(report.actionLabel.match(/[0-9]/g) ?? []).toEqual([]);
    expect(report.actionLabel).toContain("٧");
    expect(report.whereToSeeResult).toContain("مفيش أي تعديل");
    expect(report.whatWillHappen.join(" ")).not.toContain("سيحاول تنفيذ الطلب");
  });

  it("labels a health check, an architect change and a reply", async () => {
    const { buildAdminApprovalReport } = await import("@/lib/admin-approval-report");

    expect(buildAdminApprovalReport({ kind: "health", confidence: 0.8 }, "افحص صحة النظام").actionLabel).toBe("فحص صحة المتجر");
    expect(buildAdminApprovalReport({ kind: "architect", confidence: 0.5 }, "غيّر العنوان").actionLabel).toBe("تعديل على الموقع بعد مراجعتك");
    expect(buildAdminApprovalReport({ kind: "conversation", confidence: 0.4 }, "اهلا").actionLabel).toBe("رد توضيحي من المساعد");
  });
});
